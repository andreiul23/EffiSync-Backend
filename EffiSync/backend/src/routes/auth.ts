import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendRealEmailViaGmail } from "../services/email.service.js";
import { env } from "../config/env.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";

export async function authRoutes(app: FastifyInstance) {
  // Stricter rate-limit config for credential / OAuth callback endpoints to
  // mitigate brute-force and credential-stuffing attacks. Tunable per route.
  const strictLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
  };
  const oauthLimit = {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "1 minute",
      },
    },
  };

  // Initiates the Google OAuth 2.0 flow
  app.get("/google", oauthLimit, async (_request, reply) => {
    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = env.GOOGLE_REDIRECT_URI;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.send")}&access_type=offline&prompt=consent`;
    return reply.redirect(googleAuthUrl);
  });

  app.get("/google/callback", oauthLimit, async (request, reply) => {
    const callbackQuerySchema = z.object({ code: z.string().min(1) });
    const parsedQuery = callbackQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({ error: "Invalid callback query parameters." });
    }
    const { code } = parsedQuery.data;

    const googleTokenSchema = z.object({
      access_token: z.string(),
      refresh_token: z.string().optional(),
      expires_in: z.number().optional(),
      token_type: z.string().optional(),
    });
    const googleUserSchema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
    });

    try {
      const redirectUri = env.GOOGLE_REDIRECT_URI;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson: unknown = await tokenRes.json();
      const tokenParsed = googleTokenSchema.safeParse(tokenJson);
      if (!tokenParsed.success) {
        app.log.warn({ tokenJson }, "Unexpected Google token response");
        return reply.status(400).send({ error: "Failed to fetch Google access token" });
      }
      const tokenData = tokenParsed.data;

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userJson: unknown = await userInfoRes.json();
      const userParsed = googleUserSchema.safeParse(userJson);
      if (!userParsed.success) {
        return reply.status(400).send({ error: "No email retrieved from Google." });
      }
      const { email, name } = userParsed.data;

      // SECURITY: do NOT upsert blindly — that lets a Google login hijack
      // an existing email/password account. Only attach Google to an account
      // that either (a) doesn't exist yet, or (b) already had Google linked,
      // or (c) was created via OAuth (no passwordHash).
      const existing = await prisma.user.findUnique({ where: { email } });
      let user;
      if (!existing) {
        user = await prisma.user.create({
          data: {
            email,
            name: name || undefined,
            googleRefreshToken: tokenData.refresh_token || null,
          },
        });
      } else if (existing.passwordHash && !existing.googleRefreshToken) {
        // Email/password account — refuse silent linking.
        return reply.status(409).send({
          error: "An account with this email already exists. Sign in with your password first, then link Google from settings.",
        });
      } else {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: name || existing.name || undefined,
            googleRefreshToken: tokenData.refresh_token || existing.googleRefreshToken,
          },
        });
      }

      app.log.info({ userId: user.id }, "Google OAuth login success");

      // Only send a welcome email on first OAuth link
      if (!existing) {
        const subject = "Welcome to EffiSync!";
        const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind acest cont de Google. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
        sendRealEmailViaGmail(user.id, user.email, subject, htmlBody).catch((mailErr) => {
          app.log.warn({ err: mailErr, userId: user.id }, "Welcome email failed");
        });
      }

      // Async trigger for calendar sync — fire-and-forget so the redirect is instant
      import("../services/calendarSync.service.js")
        .then((mod) => mod.syncGoogleCalendar(user.id))
        .catch((err) => app.log.warn({ err, userId: user.id }, "Post-login calendar sync failed"));

      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
      return reply.redirect(`${env.FRONTEND_URL}/dashboard#token=${token}`);
    } catch (err) {
      app.log.error(err, "Google OAuth error");
      return reply.status(500).send({ error: "Failed to authenticate with Google." });
    }
  });

  // GitHub OAuth Flow
  app.get("/github", oauthLimit, async (_request, reply) => {
    const clientId = env.GITHUB_CLIENT_ID;
    if (!clientId) return reply.status(500).send({ error: "GitHub OAuth not configured" });
    const redirectUri = `${env.BACKEND_URL}/api/auth/github/callback`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("read:user user:email")}`;
    return reply.redirect(githubAuthUrl);
  });

  app.get("/github/callback", oauthLimit, async (request, reply) => {
    const callbackQuerySchema = z.object({ code: z.string().min(1) });
    const parsedQuery = callbackQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) return reply.status(400).send({ error: "No code provided" });
    const { code } = parsedQuery.data;

    const ghTokenSchema = z.object({ access_token: z.string() });
    const ghUserSchema = z.object({
      id: z.union([z.number(), z.string()]),
      email: z.string().email().nullable().optional(),
      name: z.string().nullable().optional(),
      login: z.string(),
    });
    const ghEmailsSchema = z.array(z.object({
      email: z.string().email(),
      primary: z.boolean(),
      verified: z.boolean(),
    }));

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return reply.status(500).send({ error: "GitHub OAuth not configured" });
    }

    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenJson: unknown = await tokenRes.json();
      const tokenParsed = ghTokenSchema.safeParse(tokenJson);
      if (!tokenParsed.success) {
        return reply.status(400).send({ error: "Failed to fetch access token" });
      }
      const accessToken = tokenParsed.data.access_token;

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "EffiSync" },
      });
      const userJson: unknown = await userRes.json();
      const userParsed = ghUserSchema.safeParse(userJson);
      if (!userParsed.success) {
        return reply.status(400).send({ error: "Invalid GitHub user payload" });
      }
      const userData = userParsed.data;

      let email: string | null | undefined = userData.email;
      if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "EffiSync" },
        });
        const emailsJson: unknown = await emailsRes.json();
        const emailsParsed = ghEmailsSchema.safeParse(emailsJson);
        if (emailsParsed.success) {
          const primary = emailsParsed.data.find((e) => e.primary && e.verified);
          email = primary?.email ?? emailsParsed.data[0]?.email;
        }
      }

      if (!email) {
        return reply.status(400).send({ error: "No verified email retrieved from GitHub." });
      }

      const githubId = String(userData.id);

      // SECURITY: prevent silent account-takeover. Match by githubId first.
      let user = await prisma.user.findFirst({ where: { githubId } });
      if (!user) {
        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          if (byEmail.passwordHash && !byEmail.githubId) {
            return reply.status(409).send({
              error: "An account with this email already exists. Sign in with your password first, then link GitHub from settings.",
            });
          }
          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: { githubId, name: byEmail.name || userData.name || userData.login },
          });
        } else {
          user = await prisma.user.create({
            data: {
              email,
              githubId,
              name: userData.name || userData.login,
            },
          });
          const subject = "Welcome to EffiSync!";
          const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind contul de GitHub. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
          sendRealEmailViaGmail(user.id, user.email, subject, htmlBody).catch((mailErr) => {
            app.log.warn({ err: mailErr, userId: user!.id }, "Welcome email failed");
          });
        }
      }

      const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
      return reply.redirect(`${env.FRONTEND_URL}/dashboard#token=${token}`);
    } catch (err) {
      app.log.error(err, "GitHub OAuth error");
      return reply.status(500).send({ error: "Failed to authenticate with GitHub." });
    }
  });

  app.post("/register", strictLimit, async (request, reply) => {
    const registerSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
    });
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });

    const { email, password, name } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 10);

    // Use Prisma's unique-constraint error instead of a TOCTOU find-then-create.
    let user;
    try {
      user = await prisma.user.create({
        data: { email, passwordHash, name },
      });
    } catch (err: unknown) {
      // P2002 = Prisma unique constraint violation
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002") {
        return reply.status(409).send({ error: "Email already in use" });
      }
      throw err;
    }

    const subject = "Welcome to EffiSync!";
    const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
    sendRealEmailViaGmail(user.id, user.email, subject, htmlBody).catch((mailErr) => {
      app.log.warn({ err: mailErr, userId: user.id }, "Welcome email failed");
    });

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
    return reply.send({ success: true, userId: user.id, token });
  });

  app.post("/login", strictLimit, async (request, reply) => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.status(401).send({ error: "Invalid email or password" });

    // OAuth-only account → no password to compare against. Tell the user clearly.
    if (!user.passwordHash) {
      const provider = user.googleRefreshToken ? "Google" : user.githubId ? "GitHub" : "an external provider";
      return reply.status(400).send({
        error: `This account was created with ${provider}. Please use the "Continue with ${provider}" button instead.`,
      });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return reply.status(401).send({ error: "Invalid email or password" });

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
    return reply.send({
      success: true,
      userId: user.id,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        householdId: user.householdId,
        calendarConnected: !!user.googleRefreshToken,
      },
    });
  });
  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const userId = getAuthUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: "User not found" });

    return reply.send({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        householdId: user.householdId,
        calendarConnected: !!user.googleRefreshToken,
      }
    });
  });
}
