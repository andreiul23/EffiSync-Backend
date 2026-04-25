import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
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
}
