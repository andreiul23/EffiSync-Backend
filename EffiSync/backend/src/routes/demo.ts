import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

/**
 * Demo seed routes — provide a "Try Demo" experience with pre-populated data.
 * Idempotent: re-running resets and rebuilds the demo household.
 */

const DEMO_PASSWORD = "demo1234";
const DEMO_HOUSEHOLD_NAME = "EffiSync Demo Household";
const DEMO_INVITE = "DEMO2026";

const DEMO_MEMBERS = [
  { email: "demo@effisync.app",  name: "Alex Popescu",   points: 120, role: "primary" },
  { email: "maria@effisync.app", name: "Maria Ionescu",  points: 80,  role: "member" },
  { email: "andrei@effisync.app",name: "Andrei Stoica",  points: 45,  role: "member" },
];

const DEMO_TASKS = [
  { title: "Buy groceries for the week", description: "Vegetables, milk, bread, fruit", category: "SHOPPING",       difficulty: 2, status: "PENDING",     assigneeIdx: null, daysFromNow: 1 },
  { title: "Clean the kitchen",          description: "Counters, sink, floor",            category: "CLEANING",       difficulty: 3, status: "IN_PROGRESS", assigneeIdx: 1,    daysFromNow: 0 },
  { title: "Vacuum living room",         description: "Including under sofa",             category: "CLEANING",       difficulty: 2, status: "IN_PROGRESS", assigneeIdx: 2,    daysFromNow: 0 },
  { title: "Pay electricity bill",       description: "Due in 3 days",                    category: "ADMINISTRATIVE", difficulty: 1, status: "PENDING",     assigneeIdx: null, daysFromNow: 3 },
  { title: "Read 30 minutes",            description: "Personal growth slot",             category: "PERSONAL_GROWTH",difficulty: 1, status: "IN_PROGRESS", assigneeIdx: 0,    daysFromNow: 0 },
  { title: "Take out the trash",         description: "Tuesday and Friday",               category: "OTHER",          difficulty: 1, status: "COMPLETED",   assigneeIdx: 1,    daysFromNow: -1 },
  { title: "Plan weekend dinner",        description: "Pick a recipe and shop",           category: "SHOPPING",       difficulty: 2, status: "PENDING",     assigneeIdx: null, daysFromNow: 2 },
  { title: "Water the plants",           description: "All rooms",                        category: "OTHER",          difficulty: 1, status: "COMPLETED",   assigneeIdx: 2,    daysFromNow: -2 },
];

export async function demoRoutes(app: FastifyInstance) {
  /**
   * POST /api/demo/login
   * Idempotently provisions the demo household and returns a JWT for the primary demo user.
   */
  app.post("/login", async (_request, reply) => {
    try {
      // Fast path: if the demo household + primary user already exist, skip seeding.
      const existingHousehold = await prisma.household.findFirst({ where: { inviteCode: DEMO_INVITE } });
      if (existingHousehold) {
        const primary = await prisma.user.findUnique({ where: { email: DEMO_MEMBERS[0]!.email } });
        const taskCount = await prisma.task.count({ where: { householdId: existingHousehold.id } });
        if (primary && taskCount >= DEMO_TASKS.length) {
          const token = jwt.sign({ userId: primary.id }, env.JWT_SECRET, { expiresIn: "7d" });
          return reply.send({
            success: true,
            message: "Welcome back to the EffiSync demo!",
            token,
            user: {
              id: primary.id,
              email: primary.email,
              name: primary.name,
              householdId: primary.householdId,
            },
            household: {
              id: existingHousehold.id,
              name: existingHousehold.name,
              inviteCode: existingHousehold.inviteCode,
              memberCount: DEMO_MEMBERS.length,
            },
            cached: true,
          });
        }
      }

      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

      // 1) Upsert household
      let household = existingHousehold;
      if (!household) {
        household = await prisma.household.create({
          data: {
            name: DEMO_HOUSEHOLD_NAME,
            description: "Pre-populated showcase household for EffiSync.",
            inviteCode: DEMO_INVITE,
          },
        });
      }

      // 2) Upsert demo members (in parallel) and link to household
      const users = await Promise.all(
        DEMO_MEMBERS.map((m) =>
          prisma.user.upsert({
            where: { email: m.email },
            update: {
              name: m.name,
              householdId: household!.id,
              pointsBalance: m.points,
              passwordHash,
            },
            create: {
              email: m.email,
              name: m.name,
              householdId: household!.id,
              pointsBalance: m.points,
              passwordHash,
            },
          })
        )
      );

      const primary = users[0];
      if (!primary) {
        return reply.status(500).send({ error: true, message: "Demo bootstrap failed" });
      }

      // 3) Reset tasks for a clean demo state, then bulk insert
      await prisma.task.deleteMany({ where: { householdId: household.id } });

      const now = new Date();
      const taskRows = DEMO_TASKS.map((t) => {
        const due = new Date(now);
        due.setDate(due.getDate() + t.daysFromNow);
        due.setHours(10, 0, 0, 0);
        const assignee = t.assigneeIdx !== null ? users[t.assigneeIdx] : null;
        return {
          title: t.title,
          description: t.description,
          category: t.category as any,
          difficulty: t.difficulty,
          pointsValue: t.difficulty * 10,
          status: t.status as any,
          type: "GROUP" as any,
          createdById: primary.id,
          householdId: household.id,
          assignedToId: assignee?.id,
          dueDate: due,
        };
      });
      await prisma.task.createMany({ data: taskRows });

      const token = jwt.sign({ userId: primary.id }, env.JWT_SECRET, { expiresIn: "7d" });

      return reply.send({
        success: true,
        message: "Demo environment ready. Welcome to EffiSync!",
        token,
        user: {
          id: primary.id,
          email: primary.email,
          name: primary.name,
          householdId: primary.householdId,
        },
        household: {
          id: household.id,
          name: household.name,
          inviteCode: household.inviteCode,
          memberCount: users.length,
        },
      });
    } catch (err) {
      app.log.error(err, "Demo bootstrap failed");
      return reply.status(500).send({
        error: true,
        message: "Failed to bootstrap demo environment",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/demo/info — exposes credentials so the frontend can render them on the login page.
   */
  app.get("/info", async (_request, reply) => {
    return reply.send({
      success: true,
      credentials: {
        email: DEMO_MEMBERS[0]!.email,
        password: DEMO_PASSWORD,
      },
      household: {
        name: DEMO_HOUSEHOLD_NAME,
        inviteCode: DEMO_INVITE,
        members: DEMO_MEMBERS.map((m) => ({ name: m.name, email: m.email })),
      },
    });
  });
}
