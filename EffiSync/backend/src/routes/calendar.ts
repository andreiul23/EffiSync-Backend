import type { FastifyInstance } from "fastify";
import { syncGoogleCalendar } from "../services/calendarSync.service.js";

export async function calendarRoutes(app: FastifyInstance) {
  app.post("/calendar/sync", async (request, reply) => {
    // Authenticate the user manually since we don't have a global auth middleware
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid token" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return reply.status(401).send({ error: "Missing token" });
    }
    
    let userId;
    try {
      const jwt = (await import("jsonwebtoken")).default;
      const secret = String(process.env.JWT_SECRET || "fallback_secret");
      const decoded = jwt.verify(token, secret) as any;
      userId = decoded.userId;
    } catch (err) {
      return reply.status(401).send({ error: "Invalid token" });
    }

    try {
      const result = await syncGoogleCalendar(userId);
      return reply.send({ success: true, ...result });
    } catch (err) {
      app.log.error(err, "Manual calendar sync failed");
      return reply.status(500).send({ error: "Failed to sync calendar" });
    }
  });
}
