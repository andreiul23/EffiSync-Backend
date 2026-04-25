import type { FastifyInstance } from "fastify";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { geminiModel } from "../lib/ai.js";
import { prisma } from "../lib/prisma.js";
import { getUserBusySlots } from "../services/calendar.service.js";

// ─── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are the **EffiSync Secretary** — an efficient, fair, and proactive household assistant.

## Identity
You are a helpful, organized, and fair-minded AI. You speak in a friendly but professional tone. You back your suggestions with data.

## Goal
Help households stay organized and ensure a **fair distribution of work** among all members. Every member should contribute proportionally, and no one should feel overburdened.

## Logic / Strategy
If a user asks a question like "Who should clean the kitchen?", you MUST follow these exact steps:
1. **Get State** — use \`get_household_state\` to see tasks and who has the lowest points.
2. **Check Availability** — use \`check_calendar_availability\` for the person with the lowest points.
3. **Determine Assignee** — If the lowest-points person is free, suggest them. If they are busy, suggest the next person in line who is free. You can use \`calculate_fair_assignment\` to help with this.
4. **Action** — If the user asks to create or assign a task, use \`manage_task\`. Always confirm before making database changes unless the user's intent is explicit.
5. **Explain** — Explain your reasoning (points + availability) so the household understands why the assignment is fair.

## Safety Rules
- If a tool returns an error, explain the issue to the user in plain language.
- Do not reveal internal implementation details, tool names, or database structure to the user.`;

// ─── Request Validation ─────────────────────────────────────

const chatBodySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  message: z
    .string()
    .min(1, "message cannot be empty")
    .max(4000, "message is too long"),
});
// ─── Route ──────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  app.post("/chat", async (request, reply) => {
    // ── Validate request body ──────────────────────────────
    const parsed = chatBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: true,
        message: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { userId, message } = parsed.data;

    // ── Verify user exists and fetch household context ─────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, householdId: true },
    });

    if (!user) {
      return reply.status(404).send({
        error: true,
        message: "User not found",
      });
    }

    const householdId = user.householdId;

    // ── Define AI Tools (scoped to user's household) ───────
    const aiTools = {
      get_household_state: {
        description:
          "Returns all tasks and all members' points for the current user's household.",
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async (): Promise<any> => {
          if (!householdId) {
            return { error: "User is not part of any household." };
          }

          const tasks = await prisma.task.findMany({
            where: { householdId },
            include: {
              assignedTo: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          });

          const members = await prisma.user.findMany({
            where: { householdId },
            select: { id: true, name: true, pointsBalance: true },
            orderBy: { pointsBalance: "asc" },
          });

          return { tasks, members };
        },
      },

      check_calendar_availability: {
        description:
          "Calls the Calendar service to see who is free at a specific time today. Provide the target user's ID.",
        parameters: z.object({
          targetUserId: z.string().uuid().describe("The ID of the user to check"),
        }),
        execute: async ({ targetUserId }: { targetUserId: string }): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };

          const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, googleRefreshToken: true, householdId: true },
          });

          if (!targetUser || targetUser.householdId !== householdId) {
            return { error: "Target user not found in household." };
          }

          if (!targetUser.googleRefreshToken) {
            return { error: "User has not connected their Google Calendar.", isBusy: false, reason: "No calendar connected, assuming free." };
          }

          const busySlots = await getUserBusySlots(targetUserId, targetUser.googleRefreshToken);

          // Optionally save to Availability table
          for (const slot of busySlots) {
            await prisma.availability.create({
              data: {
                userId: slot.userId,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isBusy: slot.isBusy,
              }
            });
          }

          const now = new Date();
          const currentlyBusy = busySlots.some(
            (slot) => now >= slot.startTime && now <= slot.endTime
          );

          return {
            isBusy: currentlyBusy,
            busySlots,
            message: currentlyBusy ? "User is currently busy." : "User is free.",
          };
        },
      },

      manage_task: {
        description:
          "Tool to create, assign, or update tasks in Prisma. Set action to 'create', 'assign', or 'update'.",
        parameters: z.object({
          action: z.enum(["create", "assign", "update"]),
          taskId: z.string().uuid().optional().describe("Required for assign/update"),
          title: z.string().optional().describe("Required for create"),
          description: z.string().optional(),
          difficulty: z.number().int().min(1).max(5).optional(),
          assignToUserId: z.string().uuid().optional().describe("Required for assign"),
        }),
        execute: async ({
          action,
          taskId,
          title,
          description,
          difficulty,
          assignToUserId,
        }: {
          action: "create" | "assign" | "update";
          taskId?: string;
          title?: string;
          description?: string;
          difficulty?: number;
          assignToUserId?: string;
        }): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };

          if (action === "create") {
            if (!title) return { error: "Title is required for creation." };
            const task = await prisma.task.create({
              data: {
                title,
                description,
                difficulty: difficulty || 1,
                createdById: userId,
                householdId,
                assignedToId: assignToUserId,
              },
            });
            return { success: true, task };
          }

          if (action === "assign") {
            if (!taskId || !assignToUserId) return { error: "taskId and assignToUserId required." };
            const task = await prisma.task.update({
              where: { id: taskId },
              data: { assignedToId: assignToUserId },
            });
            return { success: true, task };
          }

          if (action === "update") {
            if (!taskId) return { error: "taskId required for update." };
            const task = await prisma.task.update({
              where: { id: taskId },
              data: { title, description, difficulty },
            });
            return { success: true, task };
          }

          return { error: "Invalid action." };
        },
      },

      calculate_fair_assignment: {
        description:
          "A logic-based tool that recommends the best person for a task based on Lowest Points and Current Availability.",
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async (): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };

          const members = await prisma.user.findMany({
            where: { householdId },
            select: { id: true, name: true, pointsBalance: true, googleRefreshToken: true },
            orderBy: { pointsBalance: "asc" },
          });

          const candidates = [];

          for (const member of members) {
            let isBusy = false;
            if (member.googleRefreshToken) {
              const busySlots = await getUserBusySlots(member.id, member.googleRefreshToken);
              const now = new Date();
              isBusy = busySlots.some((slot) => now >= slot.startTime && now <= slot.endTime);
            }
            candidates.push({ ...member, isBusy });
          }

          // Best candidate is the one with lowest points who is NOT busy.
          const bestCandidate = candidates.find(c => !c.isBusy) || candidates[0]; // fallback to lowest points even if busy

          return {
            recommendation: bestCandidate,
            allCandidates: candidates,
          };
        },
      },
    };

    // ── Call the AI model with multi-step reasoning ────────
    try {
      const result = await generateText({
        model: geminiModel,
        system: SYSTEM_PROMPT,
        prompt: `[User: ${user.name ?? "Unknown"}] ${message}`,
        tools: aiTools as any,
        stopWhen: stepCountIs(10), // maxSteps: 10
      });

      return reply.status(200).send({
        response: result.text,
        steps: result.steps.map((step) => ({
          text: step.text,
          toolCalls: step.toolCalls.map((tc) => ({
            tool: tc.toolName,
            input: tc.input,
          })),
          toolResults: step.toolResults.map((tr) => ({
            tool: tr.toolName,
            output: tr.output,
          })),
        })),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "AI processing failed";

      app.log.error(err, "AI chat error");

      return reply.status(502).send({
        error: true,
        message: "Failed to process AI request",
        details: errorMessage,
      });
    }
  });
}
