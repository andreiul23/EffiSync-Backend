import type { FastifyInstance } from "fastify";
import { generateHouseholdReport } from "../services/cron.service.js";

export async function debugRoutes(app: FastifyInstance) {
  app.get("/trigger-report/:householdId", async (request, reply) => {
    const { householdId } = request.params as { householdId: string };
    
    if (!householdId) {
      return reply.status(400).send({ error: "Household ID is required" });
    }

    const result = await generateHouseholdReport(householdId);

    if (result.success) {
      return reply.send(result);
    } else {
      return reply.status(500).send(result);
    }
  });
}
