import { google } from "googleapis";
import { prisma } from "../lib/prisma.js";

function getGmailClient(userRefreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({ refresh_token: userRefreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function sendRealEmailViaGmail(userId: string, to: string, subject: string, body: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleRefreshToken) {
      console.error(`Cannot send email: Google Token missing for user ${userId}`);
      return;
    }

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
  } catch (error) {
    console.error("Email failed:", error);
  }
}

export async function sendWelcomeEmail(userId: string, userEmail: string, userName: string) {
  const subject = "Welcome to EffiSync!";
  const htmlBody = `Salut ${userName}, sunt Secretara ta EffiSync. Contul tău a fost configurat cu succes folosind acest cont de Google. De acum, te voi ajuta să îți gestionezi task-urile și casa direct de aici!`;
  
  // Fire and forget
  sendRealEmailViaGmail(userId, userEmail, subject, htmlBody);
}

export async function sendTaskAssignedEmail(assigneeUserId: string, userEmail: string, taskTitle: string, points: number) {
  const subject = "New Task Assigned in EffiSync";
  const htmlBody = `
    <h2>You have been assigned a new task: ${taskTitle}</h2>
    <p>This task is worth <strong>${points} points</strong>.</p>
    <p>Complete it to climb the leaderboard!</p>
  `;
  // Send email to the assignee using their own Gmail
  sendRealEmailViaGmail(assigneeUserId, userEmail, subject, htmlBody);
}
