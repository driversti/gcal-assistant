import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";

export async function listEventsForDate(
  auth: OAuth2Client,
  calendars: CalendarInfo[],
  date: string // YYYY-MM-DD
): Promise<CalendarEvent[]> {
  const calendarApi = google.calendar({ version: "v3", auth });
  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59.999`).toISOString();

  const results = await Promise.allSettled(
    calendars.map(async (cal) => {
      const { data } = await calendarApi.events.list({
        calendarId: cal.id,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });

      return (data.items ?? []).map((item): CalendarEvent => {
        const isAllDay = !!item.start?.date;
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

  // Sort: all-day events first, then by start time
  return events.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.start.localeCompare(b.start);
  });
}

export async function deleteEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendarApi = google.calendar({ version: "v3", auth });
  await calendarApi.events.delete({ calendarId, eventId });
}

export async function moveEvent(
  auth: OAuth2Client,
  sourceCalendarId: string,
  eventId: string,
  destinationCalendarId: string
): Promise<void> {
  const calendarApi = google.calendar({ version: "v3", auth });
  await calendarApi.events.move({
    calendarId: sourceCalendarId,
    eventId,
    destination: destinationCalendarId,
  });
}
