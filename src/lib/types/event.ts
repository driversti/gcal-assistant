export type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  status: string;
  htmlLink: string;
  created: string;
  updated: string;
  recurringEventId?: string;
  /** Recurrence frequency parsed from the master event's RRULE, or "NONE" */
  recurrence: Recurrence;
  /** Whether the event uses the calendar's default reminders */
  reminderUseDefault: boolean;
  /** First popup reminder in minutes (Google Calendar format), or null if none/default */
  reminderMinutes: number | null;
}

/**
 * Preset reminder options for all-day events.
 * Minutes count backwards from the event's END date (midnight of next day).
 */
// Reminder value encoding:
// "default" = use calendar's default reminders (useDefault: true)
// null      = no reminder (useDefault: false, overrides: [])
// number    = popup reminder at N minutes
export type ReminderValue = "default" | number | null;

export const ALL_DAY_REMINDER_PRESETS: { label: string; value: ReminderValue }[] = [
  { label: "Calendar default", value: "default" },
  { label: "None", value: null },
  { label: "9 AM on event day", value: 900 },
  { label: "1 day before at 9 AM", value: 2340 },
  { label: "2 days before at 9 AM", value: 3780 },
];

export const TIMED_REMINDER_PRESETS: { label: string; value: ReminderValue }[] = [
  { label: "Calendar default", value: "default" },
  { label: "None", value: null },
  { label: "At time of event", value: 0 },
  { label: "5 minutes before", value: 5 },
  { label: "10 minutes before", value: 10 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
];

export const RECURRENCE_PRESETS: { label: string; value: Recurrence }[] = [
  { label: "No repeat", value: "NONE" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Yearly", value: "YEARLY" },
];
