import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";

export async function searchEvents(
  auth: OAuth2Client,
  calendars: CalendarInfo[],
  query: string,
  maxResults = 50
): Promise<CalendarEvent[]> {
  const calendarApi = google.calendar({ version: "v3", auth });

  const now = new Date();
  const timeMin = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
  const timeMax = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

  const results = await Promise.allSettled(
    calendars.map(async (cal) => {
      const { data } = await calendarApi.events.list({
        calendarId: cal.id,
        q: query,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 20,
      });

      return (data.items ?? []).map((item): CalendarEvent => {
        const isAllDay = !!item.start?.date;
        const popupOverride = item.reminders?.overrides?.find(
          (o) => o.method === "popup"
        );
        return {
          id: item.id!,
          calendarId: cal.id,
          calendarName: cal.summary,
          calendarColor: cal.backgroundColor,
          summary: item.summary ?? "(No title)",
          description: item.description ?? null,
          location: item.location ?? null,
          start: isAllDay ? item.start!.date! : item.start!.dateTime!,
          end: isAllDay ? item.end!.date! : item.end!.dateTime!,
          isAllDay,
          status: item.status ?? "confirmed",
          htmlLink: item.htmlLink ?? "",
          created: item.created ?? "",
          updated: item.updated ?? "",
          recurringEventId: item.recurringEventId ?? undefined,
          reminderUseDefault: item.reminders?.useDefault ?? true,
          reminderMinutes: popupOverride?.minutes ?? null,
        };
      });
    })
  );

  const events: CalendarEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    }
  }

  return events
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, maxResults);
}
