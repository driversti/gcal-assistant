import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { CalendarEvent, Recurrence } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";

/** Parse an RRULE string array into a Recurrence value */
function parseRecurrence(rrules: string[] | null | undefined): Recurrence {
  if (!rrules || rrules.length === 0) return "NONE";
  const rule = rrules.find((r) => r.startsWith("RRULE:")) ?? rrules[0];
  if (rule.includes("FREQ=DAILY")) return "DAILY";
  if (rule.includes("FREQ=WEEKLY")) return "WEEKLY";
  if (rule.includes("FREQ=MONTHLY")) return "MONTHLY";
  if (rule.includes("FREQ=YEARLY")) return "YEARLY";
  return "NONE";
}

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
          recurrence: "NONE", // populated below for recurring events
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

  // Fetch master events to populate recurrence info for recurring events
  const recurringIds = new Map<string, string>(); // recurringEventId → calendarId
  for (const e of events) {
    if (e.recurringEventId && !recurringIds.has(e.recurringEventId)) {
      recurringIds.set(e.recurringEventId, e.calendarId);
    }
  }
  if (recurringIds.size > 0) {
    const masters = await Promise.allSettled(
      Array.from(recurringIds.entries()).map(async ([masterId, calId]) => {
        const { data } = await calendarApi.events.get({
          calendarId: calId,
          eventId: masterId,
        });
        return { masterId, recurrence: parseRecurrence(data.recurrence) };
      })
    );
    const recurrenceMap = new Map<string, Recurrence>();
    for (const r of masters) {
      if (r.status === "fulfilled") {
        recurrenceMap.set(r.value.masterId, r.value.recurrence);
      }
    }
    for (const e of events) {
      if (e.recurringEventId) {
        e.recurrence = recurrenceMap.get(e.recurringEventId) ?? "NONE";
      }
    }
  }

  // Filter out all-day events that don't actually start on this date.
  // Google Calendar uses exclusive end dates for all-day events, so an event
  // on April 4 has end="2026-04-05". The API returns it for April 5 queries
  // because the time ranges overlap. We filter those out here.
  const filtered = events.filter((e) => {
    if (!e.isAllDay) return true;
    return e.start === date;
  });

  // Sort: all-day events first, then by start time
  return filtered.sort((a, b) => {
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
