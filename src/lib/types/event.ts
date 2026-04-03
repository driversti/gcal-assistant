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
}
