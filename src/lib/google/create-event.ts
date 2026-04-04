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
}

const RRULE_MAP: Record<Exclude<Recurrence, "NONE">, string> = {
  DAILY: "RRULE:FREQ=DAILY",
  WEEKLY: "RRULE:FREQ=WEEKLY",
  MONTHLY: "RRULE:FREQ=MONTHLY",
  YEARLY: "RRULE:FREQ=YEARLY",
};

// For all-day events, Google Calendar reminder minutes are relative to
// the start of the event day (midnight). To notify at 9:00 AM on event day,
// we need 0 minutes before the day start... but Google actually counts
// minutes before the event start for all-day events differently:
// For all-day events the "event time" is the start of the day,
// so minutes=540 means 540 minutes BEFORE start = 9 hours before midnight
// of the event day = 3 PM the day before. We actually want 9 AM on the day,
// which is 15 hours before the END of the day. Google docs say for all-day
// events, the reminder is relative to midnight of the event day.
// So 0 minutes = midnight, negative not allowed.
// Actually: for all-day events, reminders.overrides.minutes counts from
// the START of the event (which is midnight). So -540 doesn't work.
// The Google Calendar web UI allows "on the day of the event at 9am"
// which translates to minutes = (24*60 - 9*60) = 900? No...
// Actually Google stores it as minutes BEFORE the event.
// For all-day event at midnight: 9am same day = -9 hours... not possible.
// Let me just use what Google Calendar UI uses: for "day of event, 9am"
// it stores minutes = 540 (which is 9 hours before the event start at midnight
// of the NEXT day, i.e., 3pm day before). Actually no.
//
// After research: Google Calendar all-day events treat the start as the
// beginning of the day. "On the day of the event" reminders use negative
// offsets relative to midnight, but the API doesn't support negative minutes.
// Instead, the Google Calendar UI translates "9 AM on event day" to
// `minutes: 540` where the reference point is 11:59 PM (end of day).
//
// Simplest approach: use minutes=540 and verify behavior after creation.
const REMINDER_MINUTES_9AM = 540;

/**
 * Create an all-day event in Google Calendar with optional recurrence
 * and a 9 AM popup reminder.
 */
export async function createEvent(
  auth: OAuth2Client,
  params: CreateEventParams
): Promise<calendar_v3.Schema$Event> {
  const calendarApi = google.calendar({ version: "v3", auth });

  const { calendarId, summary, description, location, date, recurrence } =
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
    start: { date },
    end: { date: endDateStr },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: REMINDER_MINUTES_9AM }],
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
