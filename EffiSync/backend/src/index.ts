import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.route.js";
import { chatRoutes } from "./routes/chat.js";
import { authRoutes } from "./routes/auth.js";
import { taskRoutes } from "./routes/tasks.js";
import { prisma } from "./lib/prisma.js";
import { debugRoutes } from "./routes/debug.js";
import { aiRoutes } from "./routes/ai.js";
import { householdRoutes } from "./routes/households.js";
import { startCronJobs } from "./services/cron.service.js";
/**
 * Bootstrap the Fastify server.
 */
async function main() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV === "development"
          ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
          : undefined,
    },
  });

  // ── Plugins ─────────────────────────────────────────────
  await app.register(cors, {
    origin: true, // Reflects the request origin (supports credentials, unlike "*")
    credentials: true,
  });

  // ── Global Error Handler ─────────────────────────────────
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const message =
      env.NODE_ENV === "production"
        ? "Internal Server Error"
        : error.message || "Unknown error";

    return reply
      .status(statusCode)
      .header("Content-Type", "application/json")
      .send({
        error: true,
        message,
        statusCode,
      });
  });

  // ── Routes ──────────────────────────────────────────────
  app.get("/", async (_request, reply) => {
    return reply.send({ message: "Welcome to the EffiSync API!", status: "online" });
  });

  await app.register(healthRoutes);
  await app.register(chatRoutes,     { prefix: "/api" });
  await app.register(authRoutes,     { prefix: "/api/auth" });
  await app.register(taskRoutes,     { prefix: "/api" });
  await app.register(aiRoutes,       { prefix: "/api" });
  await app.register(householdRoutes,{ prefix: "/api" });
  await app.register(debugRoutes,    { prefix: "/api/debug" });

  await app.ready();
  app.log.info(app.printRoutes({ commonPrefix: false }));

  // Start background jobs
  startCronJobs();

  // ── Graceful Shutdown ───────────────────────────────────
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully…`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  // ── Start ───────────────────────────────────────────────
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`🚀 EffiSync API running on http://localhost:${env.PORT}`);
    app.log.info(`📋 Environment: ${env.NODE_ENV}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
