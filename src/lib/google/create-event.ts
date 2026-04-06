import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { calendar_v3 } from "googleapis";

type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface CreateEventParams {
  calendarId: string;
  summary: string;
  description: string;
  location?: string | null;
  date: string; // YYYY-MM-DD (historical date)
  recurrence: Recurrence;
  reminderMinutes?: number | null; // null = no reminder, undefined = default (9 AM)
}

const RRULE_MAP: Record<Exclude<Recurrence, "NONE">, string> = {
  DAILY: "RRULE:FREQ=DAILY",
  WEEKLY: "RRULE:FREQ=WEEKLY",
  MONTHLY: "RRULE:FREQ=MONTHLY",
  YEARLY: "RRULE:FREQ=YEARLY",
};

// For all-day events, Google Calendar reminder minutes count backwards from
// midnight at the START of the event day. Examples:
//   minutes=0    → midnight on event day
//   minutes=900  → 15h before midnight → 9:00 AM day BEFORE
//   minutes=2340 → 39h before midnight → 9:00 AM 2 days before
// NOTE: "On the day at 9 AM" is NOT possible with per-event overrides —
// it requires calendar-level default notifications (useDefault: true).

/**
 * Create an all-day event in Google Calendar with optional recurrence.
 * Uses calendar default reminders by default (typically "on the day at 9 AM").
 */
export async function createEvent(
  auth: OAuth2Client,
  params: CreateEventParams
): Promise<calendar_v3.Schema$Event> {
  const calendarApi = google.calendar({ version: "v3", auth });

  const { calendarId, summary, description, location, date, recurrence, reminderMinutes } =
    params;

  // Build the next-day date for the all-day event end
  const startDate = new Date(date + "T00:00:00");
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const endDateStr = [
    endDate.getFullYear(),
    String(endDate.getMonth() + 1).padStart(2, "0"),
    String(endDate.getDate()).padStart(2, "0"),
  ].join("-");

  // reminderMinutes: undefined = calendar default, null = no reminder, number = custom
  const reminders: calendar_v3.Schema$Event["reminders"] =
    reminderMinutes === undefined
      ? { useDefault: true }
      : reminderMinutes === null
        ? { useDefault: false, overrides: [] }
        : { useDefault: false, overrides: [{ method: "popup", minutes: reminderMinutes }] };

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    description,
    transparency: "transparent", // Show as free
    start: { date },
    end: { date: endDateStr },
    reminders,
  };

  if (location) {
    requestBody.location = location;
  }

  if (recurrence !== "NONE") {
    requestBody.recurrence = [RRULE_MAP[recurrence]];
  }

  try {
    const { data } = await calendarApi.events.insert({
      calendarId,
      requestBody,
    });
    return data;
  } catch (err: unknown) {
    // Fallback: if the historical date is rejected (pre-1970), retry with current/next year
    const isDateError =
      err instanceof Error &&
      (err.message.includes("invalid") || err.message.includes("date"));

    if (isDateError) {
      console.warn(
        `[createEvent] Historical date ${date} rejected, falling back to current year`
      );
      const [, month, day] = date.split("-");
      const now = new Date();
      let fallbackYear = now.getFullYear();

      // If the month-day has already passed this year, use next year
      const thisYearDate = new Date(`${fallbackYear}-${month}-${day}T00:00:00`);
      if (thisYearDate < now) {
        fallbackYear++;
      }

      const fallbackDate = `${fallbackYear}-${month}-${day}`;
      const fallbackEnd = new Date(fallbackDate + "T00:00:00");
      fallbackEnd.setDate(fallbackEnd.getDate() + 1);
      const fallbackEndStr = [
        fallbackEnd.getFullYear(),
        String(fallbackEnd.getMonth() + 1).padStart(2, "0"),
        String(fallbackEnd.getDate()).padStart(2, "0"),
      ].join("-");

      requestBody.start = { date: fallbackDate };
      requestBody.end = { date: fallbackEndStr };

      const { data } = await calendarApi.events.insert({
        calendarId,
        requestBody,
      });
      return data;
    }

    throw err;
  }
}
