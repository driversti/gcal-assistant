export interface EventUpdateFields {
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
}

export type RecurrenceMode = "single" | "thisAndFollowing" | "all";
