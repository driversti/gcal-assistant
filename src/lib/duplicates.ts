import type { CalendarEvent } from "@/lib/types/event";

function eventKey(event: CalendarEvent): string {
  return `${event.calendarId}:${event.id}`;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function titlesMatch(a: string, b: string): boolean {
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA === normB) return true;
  return levenshtein(normA, normB) <= 3;
}

function timesClose(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.isAllDay && b.isAllDay) return true;
  if (a.isAllDay || b.isAllDay) return false;
  const diff = Math.abs(
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  return diff <= 60 * 60 * 1000; // 1 hour
}

/**
 * Detects potential duplicate events across different calendars.
 * Returns a Map of eventKey -> group number for events that are duplicates.
 */
export function detectDuplicates(
  events: CalendarEvent[]
): Map<string, number> {
  const groups: CalendarEvent[][] = [];

  for (let i = 0; i < events.length; i++) {
    let foundGroup = false;
    for (const group of groups) {
      const representative = group[0];
      if (
        events[i].calendarId !== representative.calendarId &&
        titlesMatch(events[i].summary, representative.summary) &&
        timesClose(events[i], representative)
      ) {
        group.push(events[i]);
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      groups.push([events[i]]);
    }
  }

  const result = new Map<string, number>();
  let groupIndex = 0;

  for (const group of groups) {
    if (group.length >= 2) {
      for (const event of group) {
        result.set(eventKey(event), groupIndex);
      }
      groupIndex++;
    }
  }

  return result;
}
