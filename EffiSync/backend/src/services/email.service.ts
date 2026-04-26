import { google } from "googleapis";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

function getGmailClient(userRefreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({ refresh_token: userRefreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function sendRealEmailViaGmail(userId: string, to: string, subject: string, body: string) {
  if (env.SAFE_MODE) {
    console.log(`[SAFE_MODE] Skipping email to ${to} with subject: ${subject}`);
    return { ok: true, skipped: true as const };
  }

  // Header injection guard: a CR or LF in `to`/`subject` could let an attacker
  // splice extra Bcc/Cc headers into the outgoing message. Reject early.
  if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
    throw new Error("Invalid email header value");
  }
  // Lightweight email shape check (Gmail will reject malformed addresses anyway,
  // but we want to fail fast and avoid wasted API calls).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.googleRefreshToken) {
    const reason = `Google refresh token missing for user ${userId}`;
    console.error(`Cannot send email: ${reason}`);
    throw new Error(reason);
  }

  try {
    const gmail = getGmailClient(user.googleRefreshToken);

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const messageParts = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      ``,
      body,
    ];
    const message = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`Real email sent via Gmail to ${to}`);
    return { ok: true as const };
  } catch (error) {
    console.error("Email failed:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function sendWelcomeEmail(userId: string, userEmail: string, userName: string) {
  const subject = "Welcome to EffiSync!";
  const htmlBody = `Salut ${userName}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind acest cont de Google. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
  // Fire and forget — swallow errors so this never crashes the process.
  return sendRealEmailViaGmail(userId, userEmail, subject, htmlBody).catch((err) => {
    console.warn(`[email] sendWelcomeEmail failed for ${userId}:`, err instanceof Error ? err.message : err);
    return { ok: false as const, skipped: true as const };
  });
}

export async function sendTaskAssignedEmail(assigneeUserId: string, userEmail: string, taskTitle: string, points: number) {
  const subject = "New Task Assigned in EffiSync";
  const htmlBody = `
    <h2>You have been assigned a new task: ${taskTitle}</h2>
    <p>This task is worth <strong>${points} points</strong>.</p>
    <p>Complete it to climb the leaderboard!</p>
  `;
  // Fire and forget — swallow errors so a missing refresh token can’t crash the app.
  return sendRealEmailViaGmail(assigneeUserId, userEmail, subject, htmlBody).catch((err) => {
    console.warn(`[email] sendTaskAssignedEmail failed for ${assigneeUserId}:`, err instanceof Error ? err.message : err);
    return { ok: false as const, skipped: true as const };
  });
}
