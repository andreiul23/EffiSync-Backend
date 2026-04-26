import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { generateText } from "ai";
import { geminiModel } from "../lib/ai.js";
import { sendRealEmailViaGmail } from "./email.service.js";
import { env } from "../config/env.js";

export async function generateHouseholdReport(householdId: string, preferredSenderId?: string) {
  if (env.SAFE_MODE) {
    return { success: true, message: "SAFE_MODE enabled: report generation is disabled" };
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const members = await prisma.user.findMany({
      where: { householdId },
      select: { id: true, name: true, email: true, pointsBalance: true, googleRefreshToken: true }
    });

    if (members.length === 0) return { success: false, message: "No members found" };

    const tasks = await prisma.task.findMany({
      where: {
        householdId,
        updatedAt: { gte: sevenDaysAgo }
      },
      select: { title: true, status: true, refusalCount: true, pointsValue: true, category: true, assignedTo: { select: { name: true } } }
    });

    const transactions = await prisma.pointsTransaction.findMany({
      where: {
        user: { householdId },
        createdAt: { gte: sevenDaysAgo }
      },
      select: { amount: true, reason: true, user: { select: { name: true } } }
    });

    const data = {
      members: members.map(m => ({ name: m.name || "Unknown", pointsBalance: m.pointsBalance })),
      recentTasks: tasks,
      recentTransactions: transactions
    };

    const prompt = `You are the EffiSync AI. Here is the data for this household over the last 7 days:
${JSON.stringify(data, null, 2)}

Write a fun, engaging, and slightly competitive HTML email in Romanian. 
Praise the top point earner (MVP), gently roast anyone who used too many Vetoes, and summarize the completed tasks. 
Return ONLY valid HTML. Do not use markdown code blocks (like \`\`\`html), just the raw HTML string. Make it look beautiful and modern inline styles if possible.`;

    const result = await generateText({
      model: geminiModel,
      prompt,
    });

    let htmlContent = result.text.trim();
    // Strip markdown code fences if the AI wraps the HTML in them
    htmlContent = htmlContent.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "").trim();

    // Prefer the explicit caller (the founder/clicker) if they have Gmail linked.
    // Fall back to ANY household member that has a Google refresh token.
    let sender = preferredSenderId
      ? members.find(m => m.id === preferredSenderId && m.googleRefreshToken)
      : undefined;
    if (!sender) sender = members.find(m => m.googleRefreshToken !== null);

    if (!sender) {
      const msg =
        "No household member has linked Google. Sign in with Google (or have any member do so) to enable email reports.";
      console.error(`Cannot send report for household ${householdId}: ${msg}`);
      return { success: false, message: msg, code: "NO_GMAIL_LINKED" as const };
    }

    const errors: Array<{ to: string; error: string }> = [];
    let sentCount = 0;

    for (const member of members) {
      if (!member.email) continue;
      try {
        await sendRealEmailViaGmail(
          sender.id,
          member.email,
          "🏆 Raportul Săptămânal EffiSync - Cine a dominat casa?",
          htmlContent,
        );
        sentCount += 1;
      } catch (err) {
        errors.push({
          to: member.email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (sentCount === 0) {
      return {
        success: false,
        message: "Email sending failed for every recipient.",
        code: "ALL_RECIPIENTS_FAILED" as const,
        errors,
      };
    }

    console.log(`Weekly report sent for household ${householdId} (sent=${sentCount}, failed=${errors.length})`);
    return {
      success: true,
      message: `Report sent to ${sentCount} member(s)${errors.length ? ` (${errors.length} failed)` : ""}.`,
      sender: sender.email,
      sentCount,
      errors,
    };
  } catch (error) {
    console.error(`Error generating report for household ${householdId}:`, error);
    return {
      success: false,
      error: "Report generation failed",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

export function startCronJobs() {
  if (env.SAFE_MODE) {
    console.log("SAFE_MODE enabled: cron jobs are disabled.");
    return;
  }

  // Scheduled to run every Sunday at 20:00
  cron.schedule("0 20 * * 0", async () => {
    console.log("Running weekly household reports cron job...");
    const households = await prisma.household.findMany();
    for (const household of households) {
      await generateHouseholdReport(household.id);
    }
  });
  console.log("Cron jobs scheduled.");
}
