import { prisma } from "../lib/prisma.js";
import { sendTaskAssignedEmail } from "./email.service.js";
import { VETO_COST, POINTS_MULTIPLIER, MAX_POINTS_VALUE } from "@effisync/shared";

// ─── Validate Task ──────────────────────────────────────────
export const validateTask = async (taskId: string, validatorUserId: string) => {
  return await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error("Task not found");
    }

    // Cross-household guard: validator must belong to the task's household.
    const validator = await tx.user.findUnique({
      where: { id: validatorUserId },
      select: { householdId: true },
    });
    if (!validator || validator.householdId !== task.householdId) {
      throw new Error("You can only validate tasks in your own household");
    }

    if (task.status !== "AWAITING_REVIEW" && task.status !== "IN_PROGRESS") {
      throw new Error("Task must be AWAITING_REVIEW or IN_PROGRESS to validate");
    }

    if (!task.assignedToId) {
      throw new Error("Cannot validate a task that has no assignee");
    }

    if (task.assignedToId === validatorUserId) {
      throw new Error("You cannot validate your own task");
    }

    // Race-safe transition: only flip if still in a validatable state.
    const flipped = await tx.task.updateMany({
      where: { id: taskId, status: { in: ["AWAITING_REVIEW", "IN_PROGRESS"] } },
      data: { status: "COMPLETED", validatedById: validatorUserId },
    });
    if (flipped.count === 0) {
      throw new Error("Task was already validated by someone else");
    }
    const updatedTask = await tx.task.findUniqueOrThrow({ where: { id: taskId } });

    if (updatedTask.assignedToId) {
      await tx.user.update({
        where: { id: updatedTask.assignedToId },
        data: {
          pointsBalance: {
            increment: updatedTask.pointsValue,
          },
        },
      });

      await tx.pointsTransaction.create({
        data: {
          userId: updatedTask.assignedToId,
          amount: updatedTask.pointsValue,
          reason: "Task Validated",
        },
      });
    }

    return updatedTask;
  });
};

// ─── Accept Task (Race-Condition Safe) ──────────────────────
export const acceptTask = async (taskId: string, userId: string) => {
  return await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error("Task not found");
    }

    // Verify user exists and belongs to the same household — BEFORE any writes.
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }
    if (user.householdId !== task.householdId) {
      throw new Error("You can only accept tasks in your own household");
    }

    // Atomic: only flip if still PENDING. Two concurrent accepts → one wins.
    const claimed = await tx.task.updateMany({
      where: { id: taskId, status: "PENDING" },
      data: { assignedToId: userId, status: "IN_PROGRESS" },
    });
    if (claimed.count === 0) {
      throw new Error("Task is no longer available for acceptance");
    }

    return await tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
};

// ─── Use Veto (with Refusal Cap & Points Cap) ───────────────
export const useVeto = async (taskId: string, userId: string) => {
  return await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { household: { include: { members: true } } },
    });
    if (!task) {
      throw new Error("Task not found");
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // Cross-household guard FIRST — before any state checks or writes.
    if (user.householdId !== task.householdId) {
      throw new Error("You can only veto tasks in your own household");
    }

    if (task.assignedToId !== userId) {
      throw new Error("You can only veto tasks assigned to you");
    }

    if (task.status !== "IN_PROGRESS") {
      throw new Error("You can only veto tasks that are currently IN_PROGRESS");
    }

    // ── Refusal Cap: prevent infinite veto loop ──────────
    const memberCount = task.household.members.length;
    const maxRefusals = memberCount * 2;

    if (task.refusalCount >= maxRefusals) {
      throw new Error(
        `This task has been refused ${task.refusalCount} times (limit: ${maxRefusals}). ` +
        `It can no longer be refused and must be completed.`
      );
    }

    // Race-safe veto deduction: conditional update prevents negative balance
    // even under concurrent operations. Two simultaneous vetos can't both pass.
    const deducted = await tx.user.updateMany({
      where: { id: userId, pointsBalance: { gte: VETO_COST } },
      data: { pointsBalance: { decrement: VETO_COST } },
    });
    if (deducted.count === 0) {
      throw new Error("Insufficient points to use veto (cost is 50 points)");
    }

    await tx.pointsTransaction.create({
      data: {
        userId: userId,
        amount: -VETO_COST,
        reason: "Used Veto Right",
      },
    });

    // ── Bidding: increase value with cap ─────────────────
    const newPointsValue = Math.min(
      Math.round(task.pointsValue * POINTS_MULTIPLIER),
      MAX_POINTS_VALUE
    );

    // Auto-assign to next person
    const otherMembers = task.household.members.filter(m => m.id !== userId);
    let nextAssigneeId = null;
    let nextAssigneeEmail = null;
    if (otherMembers.length > 0) {
      const nextAssignee = otherMembers[Math.floor(Math.random() * otherMembers.length)];
      if (nextAssignee) {
        nextAssigneeId = nextAssignee.id;
        nextAssigneeEmail = nextAssignee.email;
      }
    }

    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        assignedToId: nextAssigneeId,
        status: nextAssigneeId ? "IN_PROGRESS" : "PENDING",
        refusalCount: { increment: 1 },
        pointsValue: newPointsValue,
      },
    });

    if (nextAssigneeEmail && nextAssigneeId) {
      // Fire and forget
      sendTaskAssignedEmail(nextAssigneeId, nextAssigneeEmail, updatedTask.title, updatedTask.pointsValue).catch(e => console.error("Email failed:", e));
    }

    return updatedTask;
  });
};
