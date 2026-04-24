import type { FastifyInstance } from "fastify";
import { getAuthUrl, getTokens } from "../services/calendar.service.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

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
      state: z.string().optional(), // In a real app, pass userId in state
    });

    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid callback query parameters." });
    }

    try {
      const tokens = await getTokens(parsed.data.code);

      if (tokens.refresh_token) {
        // NOTE: For a real app, you need to know WHICH user just authenticated.
        // Usually, the userId is passed in the "state" parameter during the initial redirect,
        // or a session/token is used. Here, we assume we extract it from state or have a default.
        const userId = parsed.data.state; 

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { googleRefreshToken: tokens.refresh_token },
          });
        }
      }

      return reply.send({ success: true, message: "Google account connected successfully." });
    } catch (err) {
      app.log.error(err, "Google OAuth error");
      return reply.status(500).send({ error: "Failed to authenticate with Google." });
    }
  });
}
