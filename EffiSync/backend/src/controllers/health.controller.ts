import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";

/**
 * Health check controller.
 * Runs a real `SELECT 1` against the database to verify full connectivity.
 */
export async function healthCheck(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return reply.status(200).send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    return reply.status(503).send({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: message,
    });
  }
}
