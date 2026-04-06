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
// the event's END date (midnight of the next day). Examples:
//   minutes=900  → 15h before next-midnight → 9:00 AM on event day
//   minutes=540  → 9h before next-midnight  → 3:00 PM day before (wrong!)
//   minutes=2340 → 39h before next-midnight → 9:00 AM day before
const DEFAULT_REMINDER_MINUTES = 900; // 9 AM on the day of the event

/**
 * Create an all-day event in Google Calendar with optional recurrence
 * and a 9 AM popup reminder.
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

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    description,
    transparency: "transparent", // Show as free
    start: { date },
    end: { date: endDateStr },
    reminders: {
      useDefault: false,
      overrides:
        reminderMinutes === null
          ? []
          : [{ method: "popup", minutes: reminderMinutes ?? DEFAULT_REMINDER_MINUTES }],
    },
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
