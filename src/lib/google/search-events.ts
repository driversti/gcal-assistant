import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { CalendarEvent, Recurrence } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";

function parseRecurrence(rrules: string[] | null | undefined): Recurrence {
  if (!rrules || rrules.length === 0) return "NONE";
  const rule = rrules.find((r) => r.startsWith("RRULE:")) ?? rrules[0];
  if (rule.includes("FREQ=DAILY")) return "DAILY";
  if (rule.includes("FREQ=WEEKLY")) return "WEEKLY";
  if (rule.includes("FREQ=MONTHLY")) return "MONTHLY";
  if (rule.includes("FREQ=YEARLY")) return "YEARLY";
  return "NONE";
}

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
          recurrence: "NONE",
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

  // Fetch master events to populate recurrence info
  const recurringIds = new Map<string, string>();
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

  return events
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, maxResults);
}
