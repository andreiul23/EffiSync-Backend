import type { FastifyInstance } from "fastify";
import { syncGoogleCalendar } from "../services/calendarSync.service.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export async function calendarRoutes(app: FastifyInstance) {
  app.post("/calendar/sync", { preHandler: requireAuth }, async (request, reply) => {
    const userId = getAuthUserId(request);

    try {
      const result = await syncGoogleCalendar(userId);
      return reply.send({ success: true, ...result });
    } catch (err) {
      app.log.error(err, "Manual calendar sync failed");
      return reply.status(500).send({ error: "Failed to sync calendar" });
    }
  });

  /**
   * GET /api/calendar/upcoming?days=3
   * Returns the user's tasks/events scheduled in the next N days (default 3).
   * Sourced from Prisma (which is already kept in sync with Google Calendar
   * via syncCalendarToTasks), so this is a fast single-query read.
   */
  app.get("/calendar/upcoming", { preHandler: requireAuth }, async (request, reply) => {
    const userId = getAuthUserId(request);
    const daysParam = Number((request.query as { days?: string })?.days);
    const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 30 ? daysParam : 3;

    // "Next N days" = today + (N-1) following days, ending at end-of-day.
    // Previous behaviour added N full 24h windows from `now` which yielded
    // N+1 calendar days (today's remainder + N more), e.g. days=3 -> 4 days.
    const now = new Date();
    const horizon = new Date();
    horizon.setHours(0, 0, 0, 0);
    horizon.setDate(horizon.getDate() + days); // start of day N (exclusive)

    const events = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        dueDate: { gte: now, lt: horizon },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        duration: true,
        category: true,
        status: true,
        googleEventId: true,
      },
      orderBy: { dueDate: "asc" },
    });

    return reply.send({ success: true, days, events });
  });
}

