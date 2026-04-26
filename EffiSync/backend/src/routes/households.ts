import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getAuthUserId, requireAuth } from "../lib/auth.js";

export async function householdRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // POST /api/households — Create a new household
  app.post("/households", async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten().fieldErrors });

    const { name } = parsed.data;
    const createdById = getAuthUserId(request);

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
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });

    const { inviteCode } = parsed.data;
    const userId = getAuthUserId(request);

    const household = await prisma.household.findUnique({ where: { inviteCode } });
    if (!household) return reply.status(404).send({ error: "Invalid invite code" });

    await prisma.user.update({
      where: { id: userId },
      data: { householdId: household.id },
    });

    return reply.send({ success: true, householdId: household.id, householdName: household.name });
  });

  // GET /api/households/:id/suggest-time — Auto-suggest a time
  app.get("/households/:id/suggest-time", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getAuthUserId(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId || user.householdId !== id) {
      return reply.status(403).send({ error: "You can only access your own household" });
    }

    const { getHouseholdAvailability } = await import("../services/calendar.service.js");

    const timeMin = new Date();
    timeMin.setHours(8, 0, 0, 0); // Start at 8 AM
    const timeMax = new Date();
    timeMax.setHours(22, 0, 0, 0); // End at 10 PM

    const availability = await getHouseholdAvailability(id, timeMin, timeMax);
    
    // Find a 1-hour slot where everyone is free
    const allBusySlots: { start: Date, end: Date }[] = [];
    for (const member of availability.members) {
      for (const slot of member.busySlots) {
        allBusySlots.push({ start: new Date(slot.start), end: new Date(slot.end) });
      }
    }

    allBusySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    const mergedSlots: { start: Date, end: Date }[] = [];
    for (const slot of allBusySlots) {
      if (mergedSlots.length === 0) {
        mergedSlots.push(slot);
      } else {
        const last = mergedSlots[mergedSlots.length - 1];
        if (last && slot.start.getTime() <= last.end.getTime()) {
          last.end = new Date(Math.max(last.end.getTime(), slot.end.getTime()));
        } else {
          mergedSlots.push(slot);
        }
      }
    }

    let bestStart = new Date();
    if (bestStart.getHours() < 8) bestStart.setHours(8, 0, 0, 0);
    else {
      bestStart.setMinutes(0, 0, 0);
      bestStart.setHours(bestStart.getHours() + 1);
    }

    let suggestedTime = null;

    while (bestStart.getTime() + 60 * 60 * 1000 <= timeMax.getTime()) {
      const bestEnd = new Date(bestStart.getTime() + 60 * 60 * 1000);
      const hasOverlap = mergedSlots.some(s => 
        (bestStart.getTime() < s.end.getTime() && bestEnd.getTime() > s.start.getTime())
      );
      if (!hasOverlap) {
        const startStr = bestStart.toTimeString().substring(0, 5);
        const endStr = bestEnd.toTimeString().substring(0, 5);
        suggestedTime = `${startStr} - ${endStr}`;
        break;
      }
      bestStart.setHours(bestStart.getHours() + 1);
    }

    if (!suggestedTime) {
      suggestedTime = '19:00 - 20:00'; // Fallback
    }

    return reply.send({ success: true, suggestedTime });
  });

  // GET /api/households/:id — Get household details
  app.get("/households/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getAuthUserId(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user?.householdId || user.householdId !== id) {
      return reply.status(403).send({ error: "You can only access your own household" });
    }

    const household = await prisma.household.findUnique({
      where: { id },
      include: {
        members: { select: { id: true, name: true, email: true, pointsBalance: true } },
      },
    });

    if (!household) return reply.status(404).send({ error: "Household not found" });
    return reply.send({ success: true, household });
  });

  // ── Shop & Leaderboard ─────────────────────────────────
  // Static catalog (per-server). Identical for every household for now.
  // Stored here (not in DB) to avoid a schema migration; UI renders these
  // dynamically so the catalog can grow without UI changes.
  const SHOP_REWARDS: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    icon?: string;
  }> = [
    { id: "skip-chore",     title: "Skip a chore",        description: "Get out of one assigned task this week — no questions asked.", price: 100, icon: "🏖️" },
    { id: "movie-night",    title: "Pick movie night",    description: "You choose the next household movie. Vetoes don't apply.",       price: 80,  icon: "🎬" },
    { id: "dinner-choice",  title: "Choose dinner",       description: "You decide what's for dinner this Friday.",                       price: 60,  icon: "🍕" },
    { id: "extra-veto",     title: "Extra veto",          description: "Reset your veto cooldown for this week.",                         price: 120, icon: "🛑" },
    { id: "lazy-sunday",    title: "Lazy Sunday pass",    description: "No tasks assigned to you this Sunday.",                           price: 150, icon: "😎" },
    { id: "music-control",  title: "Aux cord for a day",  description: "Full control of the household speaker for 24h.",                  price: 50,  icon: "🎧" },
    { id: "coffee-run",     title: "Coffee on the house", description: "A roommate brings you coffee tomorrow morning.",                  price: 70,  icon: "☕" },
    { id: "pet-cuddles",    title: "Premium pet cuddles", description: "Exclusive 15-minute pet cuddle session, no interruptions.",       price: 40,  icon: "🐾" },
  ];

  // GET /api/households/:id/shop — Returns reward catalog
  app.get("/households/:id/shop", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getAuthUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (!user?.householdId || user.householdId !== id) {
      return reply.status(403).send({ error: "You can only access your own household" });
    }
    return reply.send({ success: true, rewards: SHOP_REWARDS });
  });

  // POST /api/households/:id/shop/purchase — Spend points to buy a reward
  app.post("/households/:id/shop/purchase", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodySchema = z.object({ rewardId: z.string().min(1) });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });

    const userId = getAuthUserId(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, householdId: true, pointsBalance: true },
    });
    if (!user?.householdId || user.householdId !== id) {
      return reply.status(403).send({ error: "You can only access your own household" });
    }

    const reward = SHOP_REWARDS.find((r) => r.id === parsed.data.rewardId);
    if (!reward) return reply.status(404).send({ error: "Reward not found" });

    if (user.pointsBalance < reward.price) {
      return reply.status(400).send({ error: "Not enough points" });
    }

    try {
      const [updated] = await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { pointsBalance: { decrement: reward.price } },
          select: { id: true, pointsBalance: true },
        }),
        prisma.pointsTransaction.create({
          data: {
            userId: user.id,
            amount: -reward.price,
            reason: `Shop purchase: ${reward.title}`,
          },
        }),
      ]);
      return reply.send({
        success: true,
        reward,
        newBalance: updated.pointsBalance,
      });
    } catch (err) {
      app.log.error(err, "Shop purchase failed");
      return reply.status(500).send({ error: "Failed to purchase reward" });
    }
  });

  // GET /api/households/:id/leaderboard — Members sorted by pointsBalance desc
  app.get("/households/:id/leaderboard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getAuthUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { householdId: true } });
    if (!user?.householdId || user.householdId !== id) {
      return reply.status(403).send({ error: "You can only access your own household" });
    }
    const members = await prisma.user.findMany({
      where: { householdId: id },
      select: { id: true, name: true, email: true, pointsBalance: true },
      orderBy: { pointsBalance: "desc" },
    });
    return reply.send({ success: true, leaderboard: members });
  });
}
