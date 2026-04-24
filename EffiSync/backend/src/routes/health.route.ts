import type { FastifyInstance } from "fastify";
import { healthCheck } from "../controllers/health.controller.js";

/**
 * Registers the health-check route.
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", healthCheck);
}
