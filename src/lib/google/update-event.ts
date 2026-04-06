import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { calendar_v3 } from "googleapis";
import type {
  EventUpdateFields,
  RecurrenceMode,
} from "@/lib/types/event-update";

/**
 * Build the Google API request body from our EventUpdateFields.
 * Only includes fields that are present (partial update).
 */
function toGoogleEventBody(
  fields: EventUpdateFields
): calendar_v3.Schema$Event {
  const body: calendar_v3.Schema$Event = {};

  if (fields.summary !== undefined) body.summary = fields.summary;
  if (fields.description !== undefined)
    body.description = fields.description ?? undefined;
  if (fields.location !== undefined)
    body.location = fields.location ?? undefined;
  if (fields.status !== undefined) body.status = fields.status;
  if (fields.transparency !== undefined) body.transparency = fields.transparency;
  if (fields.start !== undefined) body.start = fields.start;
  if (fields.end !== undefined) body.end = fields.end;
  if (fields.reminders !== undefined) body.reminders = fields.reminders;
  if (fields.recurrence !== undefined) body.recurrence = fields.recurrence;

  return body;
}

/**
 * Update an event's fields via Google Calendar API.
 *
 * recurrenceMode controls how recurring events are handled:
 * - "single" (default): patch just this instance
 * - "all": full PUT on the series master + patch the specific instance
 * - "thisAndFollowing": not natively supported by Google — we patch
 *   this instance and all following instances individually
 */
export async function updateEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
  fields: EventUpdateFields,
  recurrenceMode: RecurrenceMode = "single",
  recurringEventId?: string
): Promise<void> {
  const calendarApi = google.calendar({ version: "v3", auth });
  const body = toGoogleEventBody(fields);

  if (recurrenceMode === "single" || !recurringEventId) {
    await calendarApi.events.patch({
      calendarId,
      eventId,
      requestBody: body,
    });
    return;
  }

  if (recurrenceMode === "all") {
    // Patch the master event so all instances inherit the changes.
    await calendarApi.events.patch({
      calendarId,
      eventId: recurringEventId,
      requestBody: body,
    });

    // Materialized instances keep their own overrides — patch the specific
    // instance so the user sees the change immediately.
    if (eventId !== recurringEventId) {
      await calendarApi.events.patch({
        calendarId,
        eventId,
        requestBody: body,
      });
    }
    return;
  }

  // "thisAndFollowing": get instances from now onwards, find this one,
  // then patch this and all later instances individually.
  // Use timeMin to avoid fetching thousands of past instances.
  const { data } = await calendarApi.events.instances({
    calendarId,
    eventId: recurringEventId,
    timeMin: new Date().toISOString(),
    maxResults: 250,
  });

  const instances = data.items ?? [];
  const thisIndex = instances.findIndex((inst) => inst.id === eventId);
  if (thisIndex === -1) {
    await calendarApi.events.patch({
      calendarId,
      eventId,
      requestBody: body,
    });
    return;
  }

  const toUpdate = instances.slice(thisIndex);
  const BATCH_SIZE = 10;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((inst) =>
        calendarApi.events.patch({
          calendarId,
          eventId: inst.id!,
          requestBody: body,
        })
      )
    );
  }
}
