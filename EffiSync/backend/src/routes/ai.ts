import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { syncCalendarToTasks } from "../services/calendarSync.service.js";

export async function aiRoutes(app: FastifyInstance) {
  /**
   * POST /api/ai/initialize
   * Prepares the AI agent context for a specific user.
   * Called once after login by the frontend.
   */
  app.post("/ai/initialize", async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "userId is required" });
    }

    const { userId } = parsed.data;

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

    // Trigger a background calendar sync if the user has Google connected
    let calendarSync = null;
    if (user.googleRefreshToken && user.householdId) {
      calendarSync = await syncCalendarToTasks(
        user.id,
        user.googleRefreshToken,
        user.householdId
      ).catch((err) => {
        app.log.warn(err, "Calendar sync failed during AI init");
        return null;
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
      calendarSync,
    });
  });

  /**
   * POST /api/ai/sync-calendar
   * Manually trigger a calendar sync for a user.
   */
  app.post("/ai/sync-calendar", async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "userId required" });

    const { userId } = parsed.data;

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
}
