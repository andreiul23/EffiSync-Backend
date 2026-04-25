import type { FastifyInstance } from "fastify";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";
import { geminiModel } from "../lib/ai.js";
import { prisma } from "../lib/prisma.js";
import { getUserBusySlots, getHouseholdAvailability } from "../services/calendar.service.js";
import { useVeto } from "../services/economy.service.js";
import { sendTaskAssignedEmail } from "../services/email.service.js";
import { getAuthUserId, requireAuth } from "../lib/auth.js";

// ─── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `Ești Secretara Personală a utilizatorului. Loialitatea ta primară este față de el, dar în context de grup, ești un coordonator imparțial.

## Identity
You are a helpful, organized, and fair-minded AI. You speak in a friendly but professional tone. You back your suggestions with data.

## Goal
Help households stay organized and ensure a **fair distribution of work** among all members. Every member should contribute proportionally, and no one should feel overburdened.

## Logic / Strategy
If a user asks a question like "Who should clean the kitchen?", you MUST follow these exact steps:
1. **Get State** — use \`get_household_state\` to see tasks and who has the lowest points.
2. **Check Availability** — use \`sync_with_household\` or \`check_calendar_availability\`.
3. **Regula de Aur (Fairness)**: Când distribui un task de grup, alege membrul care este LIBER (conform raportului de sync) și care are cel mai mic pointsBalance în baza de date. Dacă toți sunt ocupați, propune primul interval comun disponibil în viitor.
4. **Action** — If the user asks to create or assign a task, use \`manage_task\`. Always confirm before making database changes unless the user's intent is explicit.
5. **Explain** — Explain your reasoning (points + availability) so the household understands why the assignment is fair.
6. **VETO** — If a user is unhappy with a task assigned to them, remind them they can use their VETO right for 50 points. If they agree, execute the veto tool.

## Safety Rules
- If a tool returns an error, explain the issue to the user in plain language.
- Do not reveal internal implementation details, tool names, or database structure to the user.
- Asigură-te că nu dezvălui detaliile evenimentelor private ale altor membri, ci doar statusul de 'Ocupat' sau 'Liber'.`;

// ─── Request Validation ─────────────────────────────────────

const chatBodySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID").optional(),
  message: z
    .string()
    .min(1, "message cannot be empty")
    .max(4000, "message is too long"),
});
// ─── Route ──────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post("/chat", async (request, reply) => {
    // ── Validate request body ──────────────────────────────
    const parsed = chatBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: true,
        message: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const authUserId = getAuthUserId(request);
    const { message } = parsed.data;

    // ── Verify user exists and fetch household context ─────
    const user = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { id: true, name: true, householdId: true },
    });

    if (!user) {
      return reply.status(404).send({
        error: true,
        message: "User not found",
      });
    }

    const userId = user.id;
    const householdId = user.householdId;

    // ── Define AI Tools (scoped to user's household) ───────
    const aiTools = {
      get_household_state: {
        description:
          "Returns all tasks and all members' points for the current user's household.",
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async (): Promise<any> => {
          if (!householdId) {
            return { error: "User is not part of any household." };
          }

          const tasks = await prisma.task.findMany({
            where: { householdId },
            include: {
              assignedTo: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          });

          const members = await prisma.user.findMany({
            where: { householdId },
            select: { id: true, name: true, pointsBalance: true },
            orderBy: { pointsBalance: "asc" },
          });

          return { tasks, members };
        },
      },

      sync_with_household: {
        description:
          "Folosește acest tool când userul cere coordonarea casei sau task-uri de grup. Returnează disponibilitatea tuturor membrilor pentru următoarele 24 de ore.",
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async (): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };
          
          const timeMin = new Date();
          const timeMax = new Date();
          timeMax.setHours(timeMax.getHours() + 24);
          
          return await getHouseholdAvailability(householdId, timeMin, timeMax);
        },
      },

      recommend_growth_activity: {
        description:
          "Scanează intervalele libere personale și propune task-uri de tip PERSONAL_GROWTH.",
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async (): Promise<any> => {
          if (!userId) return { error: "User not found." };
          
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { googleRefreshToken: true }
          });
          
          if (!dbUser || !dbUser.googleRefreshToken) {
            return { message: "Nu ai calendarul conectat. Ești considerat complet liber. Recomand o sesiune de citit de 30 minute!" };
          }
          
          const busySlots = await getUserBusySlots(userId, dbUser.googleRefreshToken);
          
          // Logic for personal growth recommendation
          if (busySlots.length > 3) {
            return { message: "Ai o zi destul de aglomerată. O scurtă sesiune de meditație (15m) ar fi de ajutor." };
          } else {
            return { message: "Ai o zi relativ liberă. Ce zici de a învăța o abilitate nouă sau de a citi un capitol dintr-o carte (1 oră)?" };
          }
        },
      },

      veto_task: {
        description:
          "Call this when the user explicitly asks to use their Veto right to reject a task assigned to them. It costs 50 points.",
        parameters: z.object({
          taskId: z.string().uuid().describe("The ID of the task to veto"),
        }),
        execute: async ({ taskId }: { taskId: string }): Promise<any> => {
          try {
            const task = await prisma.task.findUnique({ where: { id: taskId } });
            if (!task) return { error: "Task not found." };
            if (task.assignedToId !== userId) return { error: "You can only veto tasks assigned to you." };
            if (task.status !== "IN_PROGRESS") return { error: "You can only veto tasks that are currently IN_PROGRESS." };
            
            const result = await useVeto(taskId, userId);
            return { success: true, message: "Veto applied successfully. 50 points deducted.", task: result };
          } catch (err: unknown) {
            return { error: err instanceof Error ? err.message : "Unknown error" };
          }
        },
      },

      check_calendar_availability: {
        description:
          "Calls the Calendar service to see who is free at a specific time today. Provide the target user's ID.",
        parameters: z.object({
          targetUserId: z.string().uuid().describe("The ID of the user to check"),
        }),
        execute: async ({ targetUserId }: { targetUserId: string }): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };

          const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, googleRefreshToken: true, householdId: true },
          });

          if (!targetUser || targetUser.householdId !== householdId) {
            return { error: "Target user not found in household." };
          }

          if (!targetUser.googleRefreshToken) {
            return { error: "User has not connected their Google Calendar.", isBusy: false, reason: "No calendar connected, assuming free." };
          }

          const busySlots = await getUserBusySlots(targetUserId, targetUser.googleRefreshToken);

          // Optionally save to Availability table
          for (const slot of busySlots) {
            await prisma.availability.create({
              data: {
                userId: slot.userId,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isBusy: slot.isBusy,
              }
            });
          }

          const now = new Date();
          const currentlyBusy = busySlots.some(
            (slot) => now >= slot.startTime && now <= slot.endTime
          );

          return {
            isBusy: currentlyBusy,
            busySlots,
            message: currentlyBusy ? "User is currently busy." : "User is free.",
          };
        },
      },

      manage_task: {
        description:
          "Tool to create, assign, or update tasks in Prisma. Set action to 'create', 'assign', or 'update'. Must include difficulty and category when creating a task.",
        parameters: z.object({
          action: z.enum(["create", "assign", "update"]),
          taskId: z.string().uuid().optional().describe("Required for assign/update"),
          title: z.string().optional().describe("Required for create"),
          description: z.string().optional(),
          difficulty: z.number().int().min(1).max(5).optional().describe("Task difficulty from 1 to 5"),
          category: z.enum(["CLEANING", "SHOPPING", "ADMINISTRATIVE", "PERSONAL_GROWTH", "OTHER"]).optional().describe("Task category"),
          assignToUserId: z.string().uuid().optional().describe("Required for assign"),
        }),
        execute: async ({
          action,
          taskId,
          title,
          description,
          difficulty,
          category,
          assignToUserId,
        }: {
          action: "create" | "assign" | "update";
          taskId?: string;
          title?: string;
          description?: string;
          difficulty?: number;
          category?: "CLEANING" | "SHOPPING" | "ADMINISTRATIVE" | "PERSONAL_GROWTH" | "OTHER";
          assignToUserId?: string;
        }): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };

          if (action === "create") {
            if (!title) return { error: "Title is required for creation." };

            // Guardrail: verify assignee belongs to the household
            if (assignToUserId) {
              const assignee = await prisma.user.findUnique({
                where: { id: assignToUserId },
                select: { householdId: true },
              });
              if (!assignee || assignee.householdId !== householdId) {
                return { error: "Cannot assign task: target user does not exist or is not in this household." };
              }
            }

            const taskDifficulty = difficulty || 1;
            const pointsValue = taskDifficulty * 10;
            const task = await prisma.task.create({
              data: {
                title,
                description,
                difficulty: taskDifficulty,
                pointsValue,
                category: category || "OTHER",
                createdById: userId,
                householdId,
                assignedToId: assignToUserId,
                status: assignToUserId ? "IN_PROGRESS" : "PENDING",
              },
            });
            if (task.assignedToId) {
              const assignee = await prisma.user.findUnique({ where: { id: task.assignedToId } });
              if (assignee && assignee.email) {
                sendTaskAssignedEmail(assignee.id, assignee.email, task.title, task.pointsValue).catch(e => console.error("Email failed:", e));
              }
            }
            return { success: true, task };
          }

          if (action === "assign") {
            if (!taskId || !assignToUserId) return { error: "taskId and assignToUserId required." };

            // Guardrail: verify assignee belongs to the household
            const assignee = await prisma.user.findUnique({
              where: { id: assignToUserId },
              select: { householdId: true },
            });
            if (!assignee || assignee.householdId !== householdId) {
              return { error: "Cannot assign task: target user does not exist or is not in this household." };
            }

            const task = await prisma.task.update({
              where: { id: taskId },
              data: { 
                assignedToId: assignToUserId,
                status: assignToUserId ? "IN_PROGRESS" : undefined
              },
            });
            if (task.assignedToId) {
              const assignee = await prisma.user.findUnique({ where: { id: task.assignedToId } });
              if (assignee && assignee.email) {
                sendTaskAssignedEmail(assignee.id, assignee.email, task.title, task.pointsValue).catch(e => console.error("Email failed:", e));
              }
            }
            return { success: true, task };
          }

          if (action === "update") {
            if (!taskId) return { error: "taskId required for update." };
            const updateData: any = { title, description, difficulty, category };
            if (difficulty) {
              updateData.pointsValue = difficulty * 10;
            }
            const task = await prisma.task.update({
              where: { id: taskId },
              data: updateData,
            });
            return { success: true, task };
          }

          return { error: "Invalid action." };
        },
      },

      calculate_fair_assignment: {
        description:
          "A logic-based tool that recommends the best person for a task based on Load Score: (activeTasks * 10) - pointsBalance. Lowest score = best candidate. Use this before assigning any task.",
        parameters: z.object({
          _placeholder: z.string().optional(),
        }),
        execute: async (): Promise<any> => {
          if (!householdId) return { error: "User is not part of any household." };

          const members = await prisma.user.findMany({
            where: { householdId },
            select: { id: true, name: true, pointsBalance: true, googleRefreshToken: true },
          });

          const candidates = await Promise.all(
            members.map(async (member) => {
              // Count active tasks (IN_PROGRESS)
              const activeTaskCount = await prisma.task.count({
                where: { assignedToId: member.id, status: "IN_PROGRESS" },
              });

              // Load Score: higher active tasks = higher burden; more points = already rewarded = lower priority
              const loadScore = (activeTaskCount * 10) - member.pointsBalance;

              // Check calendar availability
              let isBusy = false;
              if (member.googleRefreshToken) {
                const busySlots = await getUserBusySlots(member.id, member.googleRefreshToken);
                const now = new Date();
                isBusy = busySlots.some((slot) => now >= slot.startTime && now <= slot.endTime);
              }

              return { ...member, activeTaskCount, loadScore, isBusy };
            })
          );

          // Sort by load score ascending (lower = less burdened = best candidate)
          candidates.sort((a, b) => a.loadScore - b.loadScore);

          // Prefer someone who is NOT currently busy; fallback to lowest load score
          const bestCandidate = candidates.find(c => !c.isBusy) ?? candidates[0];

          return {
            recommendation: bestCandidate,
            allCandidates: candidates,
            algorithm: "LoadScore = (activeTasks * 10) - pointsBalance",
          };
        },
      },
    };

    // ── Call the AI model with multi-step reasoning ────────
    try {
      await prisma.chatMessage.create({
        data: {
          userId,
          text: message,
          role: "USER"
        }
      });

      const result = await generateText({
        model: geminiModel,
        system: SYSTEM_PROMPT,
        prompt: `[User: ${user.name ?? "Unknown"}] ${message}`,
        tools: aiTools as any,
        stopWhen: stepCountIs(10), // maxSteps: 10
      });

      await prisma.chatMessage.create({
        data: {
          userId,
          text: result.text,
          role: "AI"
        }
      });

      return reply.status(200).send({
        response: result.text,
        steps: result.steps.map((step) => ({
          text: step.text,
          toolCalls: step.toolCalls.map((tc) => ({
            tool: tc.toolName,
            input: tc.input,
          })),
          toolResults: step.toolResults.map((tr) => ({
            tool: tr.toolName,
            output: tr.output,
          })),
        })),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "AI processing failed";

      app.log.error(err, "AI chat error");

      return reply.status(502).send({
        error: true,
        message: "Failed to process AI request",
        details: errorMessage,
      });
    }
  });


  app.get("/chat/history", async (request, reply) => {
    const userId = getAuthUserId(request);

    try {
      const messages = await prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" }
      });

      return reply.send({ success: true, messages });
    } catch (err) {
      app.log.error(err, "Chat history error");
      return reply.status(500).send({ error: "Failed to fetch chat history" });
    }
  });
}
