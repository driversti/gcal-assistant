"use client";

import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CalendarEvent } from "@/lib/types/event";

interface SearchResultsProps {
  results: CalendarEvent[];
  loading: boolean;
  query: string;
  onSelect: (event: CalendarEvent) => void;
}

function formatDate(start: string, isAllDay: boolean): string {
  const date = isAllDay ? new Date(start + "T12:00:00") : new Date(start);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(start: string, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  const date = new Date(start);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SearchResults({
  results,
  loading,
  query,
  onSelect,
}: SearchResultsProps) {
  if (query.trim().length < 2) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded-md border bg-popover shadow-lg">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      ) : results.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No results found
        </div>
      ) : (
        <>
          <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 && "s"}
          </div>
          <ScrollArea className="max-h-72">
            {results.map((event) => (
              <button
                key={`${event.calendarId}-${event.id}`}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => onSelect(event)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: event.calendarColor }}
                />
                <span className="min-w-0 flex-1 truncate">{event.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(event.start, event.isAllDay)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTime(event.start, event.isAllDay)}
                </span>
              </button>
            ))}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
