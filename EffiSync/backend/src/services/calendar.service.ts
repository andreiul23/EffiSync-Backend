import { google } from "googleapis";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/gmail.send"
    ],
    prompt: "consent",
  });
};

export const getTokens = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

export const getUserBusySlots = async (userId: string, refreshToken: string) => {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0); // Start of today
  const timeMax = new Date();
  timeMax.setHours(23, 59, 59, 999); // End of today

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busySlots = res.data.calendars?.primary?.busy || [];
    
    return busySlots.map(slot => ({
      userId,
      startTime: new Date(slot.start as string),
      endTime: new Date(slot.end as string),
      isBusy: true,
    }));
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    return [];
  }
};

export const getHouseholdAvailability = async (householdId: string, timeMin: Date, timeMax: Date) => {
  const members = await prisma.user.findMany({
    where: { householdId },
    select: { id: true, name: true, googleRefreshToken: true }
  });

  const memberReports = await Promise.all(members.map(async (member) => {
    if (!member.googleRefreshToken) {
      return {
        userId: member.id,
        name: member.name,
        busySlots: [],
        status: "No calendar connected, assuming free",
      };
    }

    try {
      const client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI
      );
      client.setCredentials({ refresh_token: member.googleRefreshToken });
      
      const calendar = google.calendar({ version: "v3", auth: client });
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: "primary" }],
        },
      });

      const busySlots = res.data.calendars?.primary?.busy || [];
      return {
        userId: member.id,
        name: member.name,
        busySlots: busySlots.map(slot => ({
          start: new Date(slot.start as string),
          end: new Date(slot.end as string)
        })),
        status: "Calendar synced",
      };
    } catch (error) {
      console.error(`Failed to fetch calendar for user ${member.id}:`, error);
      return {
        userId: member.id,
        name: member.name,
        busySlots: [],
        status: "Error fetching calendar, assuming free",
      };
    }
  }));

  return {
    timeMin,
    timeMax,
    members: memberReports
  };
};
