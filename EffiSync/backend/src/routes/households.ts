import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { randomBytes } from "crypto";

export async function householdRoutes(app: FastifyInstance) {
  // POST /api/households — Create a new household
  app.post("/households", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      createdById: z.string().uuid(),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten().fieldErrors });

    const { name, createdById } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: createdById } });
    if (!user) return reply.status(404).send({ error: "User not found" });

    const inviteCode = randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"

    const household = await prisma.household.create({
      data: {
        name,
        inviteCode,
        members: { connect: { id: createdById } },
      },
    });

    // Update user's householdId
    await prisma.user.update({
      where: { id: createdById },
      data: { householdId: household.id },
    });

    return reply.status(201).send({ success: true, household });
  });

  // POST /api/households/join — Join via invite code
  app.post("/households/join", async (request, reply) => {
    const bodySchema = z.object({
      inviteCode: z.string().min(1),
      userId: z.string().uuid(),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });

    const { inviteCode, userId } = parsed.data;

    const household = await prisma.household.findUnique({ where: { inviteCode } });
    if (!household) return reply.status(404).send({ error: "Invalid invite code" });

    await prisma.user.update({
      where: { id: userId },
      data: { householdId: household.id },
    });

    return reply.send({ success: true, householdId: household.id, householdName: household.name });
  });

  // GET /api/households/:id — Get household details
  app.get("/households/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const household = await prisma.household.findUnique({
      where: { id },
      include: {
        members: { select: { id: true, name: true, email: true, pointsBalance: true } },
      },
    });

    if (!household) return reply.status(404).send({ error: "Household not found" });
    return reply.send({ success: true, household });
  });
}
