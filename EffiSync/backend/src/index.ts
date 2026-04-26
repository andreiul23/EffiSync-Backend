import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.route.js";
import { chatRoutes } from "./routes/chat.js";
import { authRoutes } from "./routes/auth.js";
import { taskRoutes } from "./routes/tasks.js";
import { prisma } from "./lib/prisma.js";
import { debugRoutes } from "./routes/debug.js";
import { demoRoutes } from "./routes/demo.js";
import { aiRoutes } from "./routes/ai.js";
import { householdRoutes } from "./routes/households.js";
import { calendarRoutes } from "./routes/calendar.js";
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
  // CORS: in development reflect the request origin (smooth DX). In production
  // enforce an allowlist if ALLOWED_ORIGINS is set; otherwise fall back to
  // FRONTEND_URL only. This closes the open-CORS hole that would otherwise
  // let any site script the API with the user's session.
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0 && env.FRONTEND_URL) {
    allowedOrigins.push(env.FRONTEND_URL);
  }

  // Dev allowlist: localhost on common Vite/CRA ports + anything in ALLOWED_ORIGINS / FRONTEND_URL.
  const devAllowed = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...allowedOrigins,
  ]);
  const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/;

  await app.register(cors, {
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server requests have no Origin header.
      if (!origin) return cb(null, true);
      if (env.NODE_ENV === "production") {
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"), false);
      }
      // Dev: only allow whitelisted origins or local network IPs (no longer
      // reflects ARBITRARY origins, which would have been a CSRF vector if
      // the build accidentally shipped with NODE_ENV != production).
      if (devAllowed.has(origin) || localhostRegex.test(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS (dev)"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  });

  // Security headers (HSTS, CSP defaults, X-Frame-Options, etc.). CSP is
  // permissive enough for the SPA dev experience; tighten in production if
  // you serve the frontend from this origin.
  await app.register(helmet, {
    contentSecurityPolicy: false, // SPA is on a separate origin in dev
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // Global low rate limit as a baseline. Auth routes get a stricter limit
  // applied locally inside their plugin.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/health",
  });

  // Gzip / brotli responses. Saves significant bandwidth on JSON-heavy
  // endpoints (task lists, household state). Threshold avoids overhead for
  // tiny payloads.
  await app.register(compress, {
    global: true,
    threshold: 1024,
    encodings: ["br", "gzip", "deflate"],
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
  await app.register(demoRoutes,     { prefix: "/api/demo" });
  if (env.NODE_ENV !== "production") {
    await app.register(debugRoutes, { prefix: "/api/debug" });
  }

  await app.register(calendarRoutes, { prefix: "/api" });
  await app.ready();
  app.log.info(app.printRoutes({ commonPrefix: false }));

  // ── Crash guards ────────────────────────────────────────
  // A stray unhandled rejection (e.g. fire-and-forget email helper without
  // a .catch()) must NEVER kill the API process. Log and keep serving.
  process.on("unhandledRejection", (reason) => {
    app.log.warn({ reason }, "Unhandled promise rejection (suppressed)");
  });
  process.on("uncaughtException", (err) => {
    app.log.error({ err }, "Uncaught exception (suppressed)");
  });

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
