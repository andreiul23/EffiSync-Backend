import type { FastifyInstance } from "fastify";
import { getAuthUrl, getTokens, oauth2Client } from "../services/calendar.service.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { google } from "googleapis";
import bcrypt from "bcrypt";
import { sendRealEmailViaGmail } from "../services/email.service.js";

export async function authRoutes(app: FastifyInstance) {
  // Initiates the Google OAuth 2.0 flow
  app.get("/google", async (_request, reply) => {
    const url = getAuthUrl();
    return reply.redirect(url);
  });

  // Google OAuth callback
  app.get("/google/callback", async (request, reply) => {
    const querySchema = z.object({
      code: z.string(),
      state: z.string().optional(),
    });

    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid callback query parameters." });
    }

    try {
      const tokens = await getTokens(parsed.data.code);
      
      // Set credentials to fetch user info
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
      const userInfoRes = await oauth2.userinfo.get();
      
      const email = userInfoRes.data.email;
      const name = userInfoRes.data.name;

      if (!email) {
        return reply.status(400).send({ error: "No email retrieved from Google." });
      }

      // Upsert the user using the email
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
          googleRefreshToken: tokens.refresh_token || undefined, // only update if a new one is provided
        },
        create: {
          email,
          name: name || undefined,
          googleRefreshToken: tokens.refresh_token || null,
        },
      });

      console.log('Utilizator salvat cu succes:', user.id);

      const subject = "Welcome to EffiSync!";
      const htmlBody = `Salut ${user.name || "User"}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind acest cont de Google. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
      sendRealEmailViaGmail(user.id, user.email, subject, htmlBody);

      return reply.send({ 
        success: true, 
        message: "Google account connected successfully.",
        userId: user.id
      });
    } catch (err) {
      app.log.error(err, "Google OAuth error");
      return reply.status(500).send({ error: "Failed to authenticate with Google." });
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
}
