import type { FastifyInstance } from "fastify";
import { getAuthUrl, getTokens, oauth2Client } from "../services/calendar.service.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { google } from "googleapis";

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
}
