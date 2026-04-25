import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type AuthenticatedRequest = FastifyRequest & { userId?: string };

type JwtPayload = {
  userId: string;
};

/**
 * Fastify preHandler — must be async (returning a Promise) so the hook
 * pipeline awaits it. A sync `void` signature leaves the request hanging.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid token" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.status(401).send({ error: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (typeof decoded?.userId !== "string" || decoded.userId.length === 0) {
      return reply.status(401).send({ error: "Invalid token payload" });
    }
    (request as AuthenticatedRequest).userId = decoded.userId;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

/**
 * Reads the authenticated user id off the request. Throws an `UnauthorizedError`
 * (mapped to 401 by the global error handler) if `requireAuth` did not run
 * — protects against accidentally exposing endpoints without the preHandler.
 */
export class UnauthorizedError extends Error {
  public readonly statusCode = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function getAuthUserId(request: FastifyRequest): string {
  const userId = (request as AuthenticatedRequest).userId;
  if (!userId) {
    throw new UnauthorizedError("Authenticated user id missing on request — requireAuth hook not registered?");
  }
  return userId;
}

