import type { FastifyInstance } from "fastify";
import { syncGoogleCalendar } from "../services/calendarSync.service.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";

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
}
