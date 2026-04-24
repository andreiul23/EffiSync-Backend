import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.route.js";
import { chatRoutes } from "./routes/chat.js";
import { authRoutes } from "./routes/auth.js";
import { prisma } from "./lib/prisma.js";


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
    origin: env.NODE_ENV === "production" ? false : true,
    credentials: true,
  });

  // ── Global Error Handler ─────────────────────────────────
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const message =
      env.NODE_ENV === "production"
        ? "Internal Server Error"
        : error.message;

    return reply.status(statusCode).send({
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
  await app.register(chatRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/auth" });

  await app.ready();
  app.log.info(app.printRoutes({ commonPrefix: false }));

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
