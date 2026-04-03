"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/lib/types/event";
import type { ColumnKey } from "./column-toggle";
import { ALL_COLUMNS } from "./column-toggle";

interface EventsTableProps {
  events: CalendarEvent[];
  visibleColumns: ColumnKey[];
  selectedIds: Set<string>;
  onToggleSelect: (eventId: string) => void;
  onToggleAll: () => void;
  duplicateGroups: Map<string, number>;
  loading: boolean;
}

function formatTime(dateStr: string, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCellValue(event: CalendarEvent, column: ColumnKey): string {
  switch (column) {
    case "calendar":
      return event.calendarName;
    case "summary":
      return event.summary;
    case "start":
      return formatTime(event.start, event.isAllDay);
    case "end":
      return formatTime(event.end, event.isAllDay);
    case "location":
      return event.location ?? "";
    case "description":
      return event.description ?? "";
    case "status":
      return event.status;
    case "created":
      return formatDateTime(event.created);
    case "updated":
      return formatDateTime(event.updated);
  }
}

// Generate a unique key that combines event ID and calendar ID
// because the same event ID can appear in different calendars
function eventKey(event: CalendarEvent): string {
  return `${event.calendarId}:${event.id}`;
}

const DUPLICATE_COLORS = [
  "bg-yellow-100 dark:bg-yellow-900/30",
  "bg-blue-100 dark:bg-blue-900/30",
  "bg-green-100 dark:bg-green-900/30",
  "bg-pink-100 dark:bg-pink-900/30",
  "bg-purple-100 dark:bg-purple-900/30",
];

export function EventsTable({
  events,
  visibleColumns,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  duplicateGroups,
  loading,
}: EventsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading events...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No events for this date.
      </div>
    );
  }

  const allSelected =
    events.length > 0 && events.every((e) => selectedIds.has(eventKey(e)));
  const columns = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
            </TableHead>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const key = eventKey(event);
            const dupGroup = duplicateGroups.get(key);
            const rowClass =
              dupGroup !== undefined
                ? DUPLICATE_COLORS[dupGroup % DUPLICATE_COLORS.length]
                : "";

            return (
              <TableRow key={key} className={rowClass}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(key)}
                    onCheckedChange={() => onToggleSelect(key)}
                  />
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.key === "calendar" ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: event.calendarColor }}
                        />
                        <span className="truncate max-w-[150px]">
                          {event.calendarName}
                        </span>
                      </div>
                    ) : col.key === "description" ? (
                      <span
                        className="truncate block max-w-[200px]"
                        title={event.description ?? ""}
                      >
                        {getCellValue(event, col.key)}
                      </span>
                    ) : (
                      getCellValue(event, col.key)
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  {dupGroup !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      Dup {dupGroup + 1}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export { eventKey };
