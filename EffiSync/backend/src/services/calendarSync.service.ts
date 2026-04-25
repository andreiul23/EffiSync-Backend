import { google } from "googleapis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

/**
 * Syncs a user's Google Calendar events into Prisma Tasks.
 * Uses googleEventId as the deduplication key (upsert).
 */
export async function syncCalendarToTasks(userId: string, refreshToken: string, householdId: string) {
  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 14); // Next 2 weeks

  let events;
  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });
    events = res.data.items || [];
  } catch (err) {
    console.error(`Calendar sync failed for user ${userId}:`, err);
    return { synced: 0, error: "Calendar fetch failed" };
  }

  let synced = 0;

  for (const event of events) {
    if (!event.id || !event.summary) continue;

    const startTime = event.start?.dateTime ?? event.start?.date;
    const endTime   = event.end?.dateTime   ?? event.end?.date;

    if (!startTime || !endTime) continue;

    const start    = new Date(startTime);
    const end      = new Date(endTime);
    const duration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes

    try {
      const existingTask = await prisma.task.findFirst({
        where: {
          createdById: userId,
          googleEventId: event.id
        }
      });

      if (existingTask) {
        await prisma.task.update({
          where: { id: existingTask.id },
          data: {
            title:    event.summary,
            dueDate:  start,
            duration,
          }
        });
      } else {
        await prisma.task.create({
          data: {
            title:         event.summary,
            description:   event.description ?? undefined,
            googleEventId: event.id,
            dueDate:       start,
            duration,
            status:        "IN_PROGRESS",
            category:      "OTHER",
            difficulty:    1,
            pointsValue:   10,
            householdId,
            createdById:   userId,
            assignedToId:  userId,
          }
        });
      }
      synced++;
    } catch (err) {
      console.error(`Failed to upsert event ${event.id}:`, err);
    }
  }

  return { synced, total: events.length };
}
