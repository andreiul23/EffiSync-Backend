import type { FastifyInstance } from "fastify";
import { validateTask, useVeto, acceptTask } from "../services/economy.service.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { sendTaskAssignedEmail } from "../services/email.service.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";

export async function taskRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // ── Accept Task (race-condition safe) ─────────────────
  app.post("/tasks/:id/accept", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getAuthUserId(request);

    try {
      const task = await acceptTask(id, userId);
      return reply.send({ success: true, task });
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  // ── Validate Task ─────────────────────────────────────
  app.post("/tasks/:id/validate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const validatorUserId = getAuthUserId(request);

    try {
      const task = await validateTask(id, validatorUserId);
      return reply.send({ success: true, task });
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/tasks/:id/veto", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = getAuthUserId(request);

    try {
      const task = await useVeto(id, userId);
      return reply.send({ success: true, task });
    } catch (err: unknown) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/tasks", async (request, reply) => {
    const querySchema = z.object({
      userId: z.string().uuid().optional(),
      householdId: z.string().uuid().optional(),
      type: z.enum(["INDIVIDUAL", "GROUP"]).optional(),
    });
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid query" });

    const authUserId = getAuthUserId(request);
    const authUser = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { householdId: true },
    });

    if (!authUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    const { userId, householdId, type } = parsed.data;

    if (userId && userId !== authUserId) {
      return reply.status(403).send({ error: "You can only query your own tasks" });
    }

    if (householdId && householdId !== authUser.householdId) {
      return reply.status(403).send({ error: "You can only query your own household tasks" });
    }

    try {
      const orFilters: Array<Record<string, string>> = [{ assignedToId: authUserId }];
      if (authUser.householdId) {
        orFilters.push({ householdId: authUser.householdId });
      }

      const tasks = await prisma.task.findMany({
        where: {
          ...(type ? { type } : {}),
          OR: orFilters,
        },
        include: {
          assignedTo: { select: { id: true, name: true } }
        }
      });
      return reply.send({ success: true, tasks });
    } catch (err: unknown) {
      return reply.status(500).send({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/tasks", async (request, reply) => {
    const bodySchema = z.object({
      title: z.string(),
      description: z.string().optional(),
      difficulty: z.number().int().min(1).max(5).default(1),
      category: z.enum(["CLEANING", "SHOPPING", "ADMINISTRATIVE", "PERSONAL_GROWTH", "OTHER"]).default("OTHER"),
      type: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
      assignedToId: z.string().uuid().optional(),
      dueDate: z.string().optional()
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten().fieldErrors });

    const data = parsed.data;
    const pointsValue = data.difficulty * 10;
    const authUserId = getAuthUserId(request);

    const authUser = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { householdId: true },
    });

    if (!authUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    if (!authUser.householdId) {
      return reply.status(400).send({ error: "You must join a household before creating tasks" });
    }

    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: data.assignedToId },
        select: { householdId: true },
      });

      if (!assignee || assignee.householdId !== authUser.householdId) {
        return reply.status(400).send({ error: "Assignee must be a member of your household" });
      }
    }

    try {
      const task = await prisma.task.create({
        data: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          category: data.category,
          type: data.type,
          assignedToId: data.assignedToId,
          householdId: authUser.householdId,
          createdById: authUserId,
          pointsValue,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          status: data.assignedToId ? "IN_PROGRESS" : "PENDING"
        }
      });
      if (task.assignedToId) {
        const assignee = await prisma.user.findUnique({ where: { id: task.assignedToId } });
        if (assignee && assignee.email) {
          sendTaskAssignedEmail(assignee.id, assignee.email, task.title, task.pointsValue).catch(e => console.error("Email failed:", e));
        }
      }
      return reply.send({ success: true, task });
    } catch (err: unknown) {
      return reply.status(500).send({ error: "Failed to create task" });
    }
  });

  app.put("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodySchema = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      difficulty: z.number().int().min(1).max(5).optional(),
      category: z.enum(["CLEANING", "SHOPPING", "ADMINISTRATIVE", "PERSONAL_GROWTH", "OTHER"]).optional(),
      type: z.enum(["INDIVIDUAL", "GROUP"]).optional(),
      assignedToId: z.string().uuid().optional().nullable(),
      dueDate: z.string().optional().nullable(),
      status: z.enum(["PENDING", "IN_PROGRESS", "AWAITING_REVIEW", "COMPLETED", "REJECTED"]).optional()
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body" });

    const updateData: any = { ...parsed.data };
    if (parsed.data.difficulty) {
      updateData.pointsValue = parsed.data.difficulty * 10;
    }
    if (parsed.data.dueDate) {
      updateData.dueDate = new Date(parsed.data.dueDate);
    } else if (parsed.data.dueDate === null) {
      updateData.dueDate = null;
    }
    
    // Auto-update status to IN_PROGRESS if assignedToId is set and status not provided
    if (parsed.data.assignedToId && !parsed.data.status) {
      updateData.status = "IN_PROGRESS";
    }

    const authUserId = getAuthUserId(request);
    const authUser = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { householdId: true },
    });

    if (!authUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { householdId: true },
    });

    if (!existingTask) {
      return reply.status(404).send({ error: "Task not found" });
    }

    if (!authUser.householdId || existingTask.householdId !== authUser.householdId) {
      return reply.status(403).send({ error: "You can only update tasks in your household" });
    }

    if (parsed.data.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: parsed.data.assignedToId },
        select: { householdId: true },
      });

      if (!assignee || assignee.householdId !== authUser.householdId) {
        return reply.status(400).send({ error: "Assignee must be a member of your household" });
      }
    }

    try {
      const task = await prisma.task.update({
        where: { id },
        data: updateData
      });
      if (parsed.data.assignedToId && task.assignedToId) {
        const assignee = await prisma.user.findUnique({ where: { id: task.assignedToId } });
        if (assignee && assignee.email) {
          sendTaskAssignedEmail(assignee.id, assignee.email, task.title, task.pointsValue).catch(e => console.error("Email failed:", e));
        }
      }
      return reply.send({ success: true, task });
    } catch (err: unknown) {
      return reply.status(500).send({ error: "Failed to update task" });
    }
  });

  app.delete("/tasks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const authUserId = getAuthUserId(request);

    const authUser = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { householdId: true },
    });

    if (!authUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { householdId: true },
    });

    if (!existingTask) {
      return reply.status(404).send({ error: "Task not found" });
    }

    if (!authUser.householdId || existingTask.householdId !== authUser.householdId) {
      return reply.status(403).send({ error: "You can only delete tasks in your household" });
    }

    try {
      await prisma.task.delete({ where: { id } });
      return reply.send({ success: true });
    } catch (err: unknown) {
      return reply.status(500).send({ error: "Failed to delete task" });
    }
  });

  // ── Mark Task Complete (ownership verified) ───────────
  app.patch("/tasks/:id/complete", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bodySchema = z.object({ userId: z.string().uuid().optional() });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request body" });

    const userId = getAuthUserId(request);

    try {
      const task = await prisma.task.findUnique({ where: { id } });
      if (!task) return reply.status(404).send({ error: "Task not found" });
      if (task.assignedToId !== userId) return reply.status(403).send({ error: "You can only complete tasks assigned to you" });
      if (task.status === "COMPLETED") return reply.status(400).send({ error: "Task is already completed" });

      const updatedTask = await prisma.$transaction(async (tx) => {
        const t = await tx.task.update({
          where: { id },
          data: { status: "COMPLETED" },
          include: { assignedTo: { select: { id: true, name: true } } }
        });
        await tx.user.update({
          where: { id: userId },
          data: { pointsBalance: { increment: t.pointsValue } },
        });
        await tx.pointsTransaction.create({
          data: { userId, amount: t.pointsValue, reason: `Task completed: ${t.title}` },
        });
        return t;
      });

      return reply.send({ success: true, task: updatedTask });
    } catch (err: unknown) {
      return reply.status(500).send({ error: "Failed to complete task" });
    }
  });
}
