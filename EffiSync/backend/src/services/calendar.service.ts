import { google } from "googleapis";
import { env } from "../config/env.js";

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
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
