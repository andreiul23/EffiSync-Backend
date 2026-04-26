import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateObject } from "ai";
import { prisma } from "../lib/prisma.js";
import { geminiModel } from "../lib/ai.js";
import { syncCalendarToTasks } from "../services/calendarSync.service.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";

export async function aiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /**
   * POST /api/ai/initialize
   * Prepares the AI agent context for a specific user.
   * Called once after login by the frontend.
   */
  app.post("/ai/initialize", async (request, reply) => {
    const userId = getAuthUserId(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        householdId: true,
        googleRefreshToken: true,
        pointsBalance: true,
      },
    });

    if (!user) return reply.status(404).send({ error: "User not found" });

    // Fire-and-forget calendar sync so the response returns immediately.
    // Awaiting this saturates the Prisma connection pool and blocks every
    // other request for ~30s while 50 events are upserted.
    if (user.googleRefreshToken && user.householdId) {
      syncCalendarToTasks(user.id, user.googleRefreshToken, user.householdId).catch((err) => {
        app.log.warn(err, "Background calendar sync failed during AI init");
      });
    }

    return reply.send({
      success: true,
      message: "Secretara ta AI este pregătită să îți eficientizeze programul!",
      user: {
        id: user.id,
        name: user.name,
        householdId: user.householdId,
        pointsBalance: user.pointsBalance,
        hasCalendar: !!user.googleRefreshToken,
      },
      calendarSync: user.googleRefreshToken ? { status: "scheduled" } : null,
    });
  });

  /**
   * POST /api/ai/sync-calendar
   * Manually trigger a calendar sync for a user.
   */
  app.post("/ai/sync-calendar", async (request, reply) => {
    const userId = getAuthUserId(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, householdId: true, googleRefreshToken: true },
    });

    if (!user) return reply.status(404).send({ error: "User not found" });
    if (!user.googleRefreshToken) return reply.status(400).send({ error: "Google Calendar not connected" });
    if (!user.householdId) return reply.status(400).send({ error: "User not in a household" });

    const result = await syncCalendarToTasks(user.id, user.googleRefreshToken, user.householdId);
    return reply.send({ success: true, ...result });
  });

  /**
   * POST /api/ai/suggest-task
   * Given a freeform prompt + the user's household context, asks Gemini to
   * propose a fully-structured group task: title, description, difficulty,
   * category, points, suggested assignee, and a suggested time window.
   *
   * The model is *grounded* on real data: current members, their pending
   * workload, and recently completed tasks. This makes the suggestion
   * tangible (different per household, not a fixed template).
   */
  app.post("/ai/suggest-task", async (request, reply) => {
    const bodySchema = z.object({
      prompt: z.string().min(3).max(500),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid prompt" });

    const userId = getAuthUserId(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true },
    });
    if (!user?.householdId) return reply.status(400).send({ error: "User not in a household" });

    // Gather household context
    const [members, openTasks] = await Promise.all([
      prisma.user.findMany({
        where: { householdId: user.householdId },
        select: { id: true, name: true, email: true, pointsBalance: true },
      }),
      prisma.task.findMany({
        where: { householdId: user.householdId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        select: { id: true, title: true, difficulty: true, assignedToId: true, category: true },
        take: 25,
      }),
    ]);

    const memberSummaries = members.map((m) => {
      const load = openTasks.filter((t) => t.assignedToId === m.id).length;
      return `- ${m.name || m.email} (id=${m.id}, points=${m.pointsBalance}, openTasks=${load})`;
    }).join("\n");

    const taskSummaries = openTasks
      .map((t) => `- "${t.title}" (cat=${t.category}, diff=${t.difficulty})`)
      .join("\n") || "(no open tasks)";

    const memberIds = members.map((m) => m.id);

    const schema = z.object({
      title: z.string().describe("Concise actionable task title (3-7 words)"),
      description: z.string().describe("Why and how, 1-2 sentences. Include any relevant detail from the user's prompt."),
      difficulty: z.number().int().min(1).max(5).describe("1=trivial, 3=moderate, 5=hard"),
      category: z.enum(["CLEANING", "SHOPPING", "ADMINISTRATIVE", "PERSONAL_GROWTH", "OTHER"]),
      pointsValue: z.number().int().min(5).max(300).describe("Reward points; scale with difficulty (5-30 easy, 40-80 medium, 100-300 hard)."),
      assignedToId: z.string().describe("MUST be an exact id from the provided members list, picked to balance their workload. If genuinely none fit, return empty string."),
      suggestedTime: z.string().describe('Time window in HH:MM - HH:MM format (24h), e.g. "18:00 - 19:00"'),
      reasoning: z.string().describe("One short sentence explaining why this assignee + time was chosen."),
    });

    try {
      const { object } = await generateObject({
        model: geminiModel,
        schema,
        prompt: `You are EffiSync's AI household coordinator. A user just asked to plan a new group task.\n\nUSER PROMPT:\n"""${parsed.data.prompt}"""\n\nHOUSEHOLD MEMBERS:\n${memberSummaries}\n\nCURRENT OPEN TASKS:\n${taskSummaries}\n\nProduce ONE concrete task tailored to this household. Pick the assignee with the lightest current workload unless the prompt specifies someone. Choose a sensible evening time slot (typical 17:00-21:00) unless the prompt suggests otherwise. The assignedToId MUST come from the members list above.`,
      });

      // Sanitize assignee — the model occasionally hallucinates; fall back to lightest-load member
      const validAssignee = memberIds.includes(object.assignedToId)
        ? object.assignedToId
        : members.slice().sort((a, b) => {
            const la = openTasks.filter((t) => t.assignedToId === a.id).length;
            const lb = openTasks.filter((t) => t.assignedToId === b.id).length;
            return la - lb;
          })[0]?.id ?? "";

      return reply.send({
        success: true,
        suggestion: {
          ...object,
          assignedToId: validAssignee,
        },
        members: members.map((m) => ({ id: m.id, name: m.name || m.email })),
      });
    } catch (err) {
      app.log.error(err, "AI suggest-task failed");
      return reply.status(500).send({ error: "AI suggestion failed", details: err instanceof Error ? err.message : String(err) });
    }
  });
}
