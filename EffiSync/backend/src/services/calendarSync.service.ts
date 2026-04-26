import { google } from "googleapis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

/**
 * In-memory throttle: avoid re-syncing the same user more than once per minute.
 * Without this, every login + every React StrictMode double-mount triggers
 * 50 sequential DB upserts that saturate the pgbouncer pool (~25s of blocking).
 */
const lastSyncAt = new Map<string, number>();
const SYNC_COOLDOWN_MS = 60_000;
const MAX_EVENTS = 25;
const PARALLEL_CHUNK = 5;

/**
 * Syncs a user's Google Calendar events into Prisma Tasks.
 * Uses googleEventId as the deduplication key (upsert).
 */
export async function syncCalendarToTasks(userId: string, refreshToken: string, householdId: string) {
  const now = Date.now();
  const last = lastSyncAt.get(userId);
  if (last && now - last < SYNC_COOLDOWN_MS) {
    return { synced: 0, skipped: true, reason: "cooldown" };
  }
  lastSyncAt.set(userId, now);

  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date();
  timeMax.setMonth(timeMax.getMonth() + 1);

  let events;
  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: MAX_EVENTS,
    });
    events = res.data.items || [];
  } catch (err) {
    console.error(`Calendar sync failed for user ${userId}:`, err);
    return { synced: 0, error: "Calendar fetch failed" };
  }

  // 1) Single batched lookup of existing rows (1 query instead of N)
  const validEvents = events.filter(e => e.id && e.summary && (e.start?.dateTime || e.start?.date));
  if (validEvents.length === 0) return { synced: 0, total: 0 };

  const existing = await prisma.task.findMany({
    where: {
      createdById: userId,
      googleEventId: { in: validEvents.map(e => e.id!) },
    },
    select: { id: true, googleEventId: true },
  });
  const existingByEventId = new Map(existing.map(t => [t.googleEventId, t.id]));

  // 2) Run upserts in small parallel chunks instead of fully serial
  let synced = 0;
  for (let i = 0; i < validEvents.length; i += PARALLEL_CHUNK) {
    const chunk = validEvents.slice(i, i + PARALLEL_CHUNK);
    const ops = chunk.map(async (event) => {
      const startTime = event.start?.dateTime ?? event.start?.date;
      const endTime = event.end?.dateTime ?? event.end?.date ?? startTime;
      if (!startTime || !endTime) return;
      const start = new Date(startTime);
      const end = new Date(endTime);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);
      const existingId = existingByEventId.get(event.id!);
      try {
        if (existingId) {
          await prisma.task.update({
            where: { id: existingId },
            data: { title: event.summary!, dueDate: start, duration },
          });
        } else {
          await prisma.task.create({
            data: {
              title: event.summary!,
              description: event.description ?? undefined,
              googleEventId: event.id!,
              dueDate: start,
              duration,
              status: "IN_PROGRESS",
              category: "OTHER",
              difficulty: 1,
              pointsValue: 10,
              householdId,
              createdById: userId,
              assignedToId: userId,
            },
          });
        }
        synced++;
      } catch (err) {
        console.error(`Failed to upsert event ${event.id}:`, err);
      }
    });
    await Promise.all(ops);
  }

  return { synced, total: validEvents.length };
}

/**
 * Wrapper for syncCalendarToTasks that looks up the user's refreshToken and household.
 */
export async function syncGoogleCalendar(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || !user.googleRefreshToken) {
    return { synced: 0, error: "No Google token found for user" };
  }

  if (!user.householdId) {
    console.log(`User ${userId} has no household; skipping calendar sync.`);
    return { synced: 0, skipped: true, reason: "No household" };
  }

  return syncCalendarToTasks(userId, user.googleRefreshToken, user.householdId);
}
