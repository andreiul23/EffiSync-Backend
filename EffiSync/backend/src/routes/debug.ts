import type { FastifyInstance } from "fastify";
import { generateHouseholdReport } from "../services/cron.service.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export async function debugRoutes(app: FastifyInstance) {
  // SECURITY: every debug route requires a valid JWT.
  app.addHook("preHandler", requireAuth);

  app.get("/trigger-report/:householdId", async (request, reply) => {
    const { householdId } = request.params as { householdId: string };

    if (!householdId) {
      return reply.status(400).send({ error: "Household ID is required" });
    }

    // SECURITY: only members of the household can trigger its report.
    const userId = getAuthUserId(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });
    if (!user || user.householdId !== householdId) {
      return reply.status(403).send({ error: "You can only trigger a report for your own household" });
    }

    const result = await generateHouseholdReport(householdId, userId);

    if (result.success) {
      return reply.send(result);
    }
    // Surface meaningful diagnostics so the UI can show what's wrong
    // (e.g. NO_GMAIL_LINKED) instead of a generic "Failed to fetch".
    return reply.status(400).send(result);
  });
}
