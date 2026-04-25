import { prisma } from "../lib/prisma.js";
import { sendTaskAssignedEmail } from "./email.service.js";

// ─── Constants ──────────────────────────────────────────────
const VETO_COST = 50;
const POINTS_MULTIPLIER = 1.5;
const MAX_POINTS_VALUE = 500; // Hard cap to prevent infinite inflation

// ─── Validate Task ──────────────────────────────────────────
export const validateTask = async (taskId: string, validatorUserId: string) => {
  return await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error("Task not found");
    }

    if (task.status !== "AWAITING_REVIEW" && task.status !== "IN_PROGRESS") {
      throw new Error("Task must be AWAITING_REVIEW or IN_PROGRESS to validate");
    }

    if (task.assignedToId === validatorUserId) {
      throw new Error("You cannot validate your own task");
    }

    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        validatedById: validatorUserId,
      },
    });

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

    // Prevent double-acceptance: only PENDING tasks can be accepted
    if (task.status !== "PENDING") {
      throw new Error("Task is no longer available for acceptance (status: " + task.status + ")");
    }

    // Verify user exists and belongs to the same household
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }
    if (user.householdId !== task.householdId) {
      throw new Error("You can only accept tasks in your own household");
    }

    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        assignedToId: userId,
        status: "IN_PROGRESS",
      },
    });

    return updatedTask;
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

    if (user.pointsBalance < VETO_COST) {
      throw new Error("Insufficient points to use veto (cost is 50 points)");
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

    // Deduct veto cost from user
    await tx.user.update({
      where: { id: userId },
      data: {
        pointsBalance: {
          decrement: VETO_COST,
        },
      },
    });

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
