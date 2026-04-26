import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

/**
 * Prisma Singleton
 *
 * In development, hot-reloading can cause multiple PrismaClient instances.
 * We store the client on `globalThis` to prevent exhausting the connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
    // Verbose 'query' logging dominated dev-mode latency (every request was
    // duplicating ~80 lines of SQL to stdout). Keep only warnings + errors.
    log: ["warn", "error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
