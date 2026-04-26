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

    // Allow viewing another user's tasks ONLY if they are in the same household.
    // This powers the "see what this roommate is up to" view in the member modal.
    if (userId && userId !== authUserId) {
      if (!authUser.householdId) {
        return reply.status(403).send({ error: "You can only query your own tasks" });
      }
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { householdId: true },
      });
      if (!target || target.householdId !== authUser.householdId) {
        return reply.status(403).send({ error: "That user is not in your household" });
      }
    }

    if (householdId && householdId !== authUser.householdId) {
      return reply.status(403).send({ error: "You can only query your own household tasks" });
    }

    try {
      // Personal-style query (?userId=me): return individual tasks I own
      // + any group tasks assigned to me. Do NOT leak other members' tasks.
      // Household-style query: return all tasks in the household (group view).
      let where: Record<string, unknown>;
      if (userId) {
        where = {
          ...(type ? { type } : {}),
          OR: [
            { assignedToId: userId },
            { AND: [{ type: "INDIVIDUAL" }, { createdById: userId }] },
          ],
        };
      } else if (householdId) {
        where = {
          householdId,
          ...(type ? { type } : {}),
        };
      } else {
        // Fallback: tasks I own or am assigned
        where = {
          ...(type ? { type } : {}),
          OR: [
            { assignedToId: authUserId },
            { createdById: authUserId },
          ],
        };
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } }
        }
      });
      return reply.send({ success: true, tasks });
    } catch (err: unknown) {
      return reply.status(500).send({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/tasks", async (request, reply) => {
    const bodySchema = z.object({
      title: z.string().trim().min(1, "Title is required").max(200),
      description: z.string().max(2000).optional(),
      difficulty: z.number().int().min(1).max(5).default(1),
      pointsValue: z.number().int().min(1).max(1000).optional(),
      category: z.enum(["CLEANING", "SHOPPING", "ADMINISTRATIVE", "PERSONAL_GROWTH", "OTHER"]).default("OTHER"),
      type: z.enum(["INDIVIDUAL", "GROUP"]).default("INDIVIDUAL"),
      assignedToId: z.string().uuid().optional(),
      dueDate: z
        .string()
        .optional()
        .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), {
          message: "dueDate must be a valid ISO date string",
        })
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid body", details: parsed.error.flatten().fieldErrors });

    const data = parsed.data;
    const pointsValue = Number.isFinite(data.pointsValue) ? data.pointsValue! : data.difficulty * 10;
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
      title: z.string().trim().min(1, "Title cannot be empty").max(200).optional(),
      description: z.string().max(2000).optional(),
      difficulty: z.number().int().min(1).max(5).optional(),
      category: z.enum(["CLEANING", "SHOPPING", "ADMINISTRATIVE", "PERSONAL_GROWTH", "OTHER"]).optional(),
      type: z.enum(["INDIVIDUAL", "GROUP"]).optional(),
      assignedToId: z.string().uuid().optional().nullable(),
      dueDate: z
        .string()
        .optional()
        .nullable()
        .refine((v) => v === undefined || v === null || !Number.isNaN(Date.parse(v)), {
          message: "dueDate must be a valid ISO date string",
        }),
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
      select: { householdId: true, createdById: true, assignedToId: true },
    });

    if (!existingTask) {
      return reply.status(404).send({ error: "Task not found" });
    }

    if (!authUser.householdId || existingTask.householdId !== authUser.householdId) {
      return reply.status(403).send({ error: "You can only delete tasks in your household" });
    }

    // Only the task creator OR its current assignee can delete it. Prevents
    // any household member from nuking everyone else's tasks.
    if (existingTask.createdById !== authUserId && existingTask.assignedToId !== authUserId) {
      return reply.status(403).send({ error: "Only the task creator or assignee can delete this task" });
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
      // Race-safe completion: a single conditional update guards against
      // double-clicks awarding points twice. Only one concurrent request
      // can flip status from a non-COMPLETED state to COMPLETED.
      const updatedTask = await prisma.$transaction(async (tx) => {
        const flipped = await tx.task.updateMany({
          where: {
            id,
            assignedToId: userId,
            status: { not: "COMPLETED" },
          },
          data: { status: "COMPLETED" },
        });
        if (flipped.count === 0) {
          // Either the task doesn't exist, isn't ours, or is already completed.
          // Distinguish for a cleaner error.
          const existing = await tx.task.findUnique({
            where: { id },
            select: { id: true, assignedToId: true, status: true },
          });
          if (!existing) throw new Error("NOT_FOUND");
          if (existing.assignedToId !== userId) throw new Error("FORBIDDEN");
          if (existing.status === "COMPLETED") throw new Error("ALREADY_COMPLETED");
          throw new Error("UPDATE_FAILED");
        }

        const t = await tx.task.findUnique({
          where: { id },
          include: { assignedTo: { select: { id: true, name: true, email: true } } },
        });
        if (!t) throw new Error("NOT_FOUND");

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
      if (err instanceof Error) {
        if (err.message === "NOT_FOUND") return reply.status(404).send({ error: "Task not found" });
        if (err.message === "FORBIDDEN") return reply.status(403).send({ error: "You can only complete tasks assigned to you" });
        if (err.message === "ALREADY_COMPLETED") return reply.status(400).send({ error: "Task is already completed" });
      }
      return reply.status(500).send({ error: "Failed to complete task" });
    }
  });
}
