import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendRealEmailViaGmail } from "../services/email.service.js";

export async function authRoutes(app: FastifyInstance) {
  // Initiates the Google OAuth 2.0 flow
  app.get("/google", async (_request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = "http://localhost:3000/api/auth/google/callback";
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.send")}&access_type=offline&prompt=consent`;
    return reply.redirect(googleAuthUrl);
  });

  app.get("/google/callback", async (request, reply) => {
    const code = (request.query as any).code;
    if (!code) {
      return reply.status(400).send({ error: "Invalid callback query parameters." });
    }

    try {
      const redirectUri = "http://localhost:3000/api/auth/google/callback";
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = (await tokenRes.json()) as any;
      
      if (!tokenData.access_token) {
        return reply.status(400).send({ error: "Failed to fetch Google access token" });
      }

      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = (await userInfoRes.json()) as any;
      
      const email = userData.email;
      const name = userData.name;

      if (!email) {
        return reply.status(400).send({ error: "No email retrieved from Google." });
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
          googleRefreshToken: tokenData.refresh_token || undefined,
        },
        create: {
          email,
          name: name || undefined,
          googleRefreshToken: tokenData.refresh_token || null,
        },
      });

      console.log('Utilizator salvat cu succes:', user.id);

      const subject = "Welcome to EffiSync!";
      const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind acest cont de Google. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
      sendRealEmailViaGmail(user.id, user.email, subject, htmlBody);

      // Async trigger for calendar sync
      import("../services/calendarSync.service.js").then((mod) => {
        mod.syncGoogleCalendar(user.id).catch(err => console.error("Post-login sync failed:", err));
      });

      const secret: string = process.env.JWT_SECRET || "fallback_secret";
      const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });
      return reply.redirect(`http://localhost:5173/dashboard?token=${token}`);
    } catch (err) {
      app.log.error(err, "Google OAuth error");
      return reply.status(500).send({ error: "Failed to authenticate with Google." });
    }
  });

  // GitHub OAuth Flow
  app.get("/github", async (_request, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = "http://localhost:3000/api/auth/github/callback";
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user user:email`;
    return reply.redirect(githubAuthUrl);
  });

  app.get("/github/callback", async (request, reply) => {
    const code = (request.query as any).code;
    if (!code) return reply.status(400).send({ error: "No code provided" });

    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = (await tokenRes.json()) as any;
      if (!tokenData.access_token) {
        return reply.status(400).send({ error: "Failed to fetch access token" });
      }

      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = (await userRes.json()) as any;

      let email = userData.email;
      if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const emails = (await emailsRes.json()) as any;
        const primaryEmail = emails.find((e: any) => e.primary && e.verified);
        email = primaryEmail ? primaryEmail.email : emails[0]?.email;
      }

      if (!email) {
        return reply.status(400).send({ error: "No email retrieved from GitHub." });
      }

      const githubId = String(userData.id);

      let user = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { githubId }]
        }
      });

      if (user) {
        if (!user.githubId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { githubId }
          });
        }
      } else {
        user = await prisma.user.create({
          data: {
            email,
            githubId,
            name: userData.name || userData.login,
          }
        });

        const subject = "Welcome to EffiSync!";
        const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind contul de GitHub. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
        sendRealEmailViaGmail(user.id, user.email, subject, htmlBody);
      }

      const secret: string = process.env.JWT_SECRET || "fallback_secret";
      const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });
      return reply.redirect(`http://localhost:5173/dashboard?token=${token}`);
    } catch (err) {
      app.log.error(err, "GitHub OAuth error");
      return reply.status(500).send({ error: "Failed to authenticate with GitHub." });
    }
  });

  app.post("/register", async (request, reply) => {
    const registerSchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
    });
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });

    const { email, password, name } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return reply.status(400).send({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const subject = "Welcome to EffiSync!";
    const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind acest cont de Google. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
    sendRealEmailViaGmail(user.id, user.email, subject, htmlBody);

    return reply.send({ success: true, userId: user.id });
  });

  app.post("/login", async (request, reply) => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid input" });

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return reply.status(401).send({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return reply.status(401).send({ error: "Invalid email or password" });

    return reply.send({ success: true, userId: user.id });
  });
  app.get("/me", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid token" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return reply.status(401).send({ error: "Missing token" });
    }
    try {
      const decoded = jwt.verify(token, String(process.env.JWT_SECRET || "fallback_secret")) as unknown as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return reply.send({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          householdId: user.householdId,
        }
      });
    } catch (err) {
      return reply.status(401).send({ error: "Invalid token" });
    }
  });
}
