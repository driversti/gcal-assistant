import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { CalendarInfo } from "@/lib/types/calendar";

export async function listCalendars(
  auth: OAuth2Client
): Promise<CalendarInfo[]> {
  const calendar = google.calendar({ version: "v3", auth });
  const { data } = await calendar.calendarList.list();

  return (data.items ?? []).map((item) => ({
    id: item.id!,
    summary: item.summary ?? "Untitled",
    backgroundColor: item.backgroundColor ?? "#4285f4",
    foregroundColor: item.foregroundColor ?? "#ffffff",
    primary: item.primary ?? false,
    accessRole: item.accessRole ?? "reader",
  }));
}
