"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { CalendarEvent } from "@/lib/types/event";

interface EventComparisonProps {
  events: CalendarEvent[];
}

const COMPARE_FIELDS: { key: keyof CalendarEvent; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "calendarName", label: "Calendar" },
  { key: "start", label: "Start" },
  { key: "end", label: "End" },
  { key: "location", label: "Location" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "isAllDay", label: "All day" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.length === 0) return "(empty)";
  return String(value);
}

export function EventComparison({ events }: EventComparisonProps) {
  if (events.length < 2) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">Comparison</h3>
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2">
          {COMPARE_FIELDS.map((field) => {
            const values = events.map((e) => formatValue(e[field.key]));
            const allSame = values.every((v) => v === values[0]);

            return (
              <div key={field.key}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </span>
                  {!allSame && (
                    <Badge variant="destructive" className="text-[10px] px-1">
                      differs
                    </Badge>
                  )}
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${events.length}, 1fr)` }}>
                  {events.map((event, i) => (
                    <div
                      key={`${event.calendarId}:${event.id}`}
                      className={`rounded-md px-3 py-1.5 text-sm ${
                        !allSame
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: event.calendarColor }}
                        />
                        <span className="text-[10px] text-muted-foreground truncate">
                          Event {i + 1}
                        </span>
                      </div>
                      <span className="break-words">{values[i]}</span>
                    </div>
                  ))}
                </div>
                <Separator className="mt-2" />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
