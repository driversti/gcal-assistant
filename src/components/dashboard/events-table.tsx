"use client";

import { useState, useCallback } from "react";
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
import type { CalendarInfo } from "@/lib/types/calendar";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
import type { ColumnKey } from "./column-toggle";
import { ALL_COLUMNS } from "./column-toggle";
import { InlineTextCell } from "./cells/inline-text-cell";
import { DescriptionPopoverCell } from "./cells/description-popover-cell";
import { DateTimePopoverCell } from "./cells/date-time-popover-cell";
import { StatusDropdownCell } from "./cells/status-dropdown-cell";
import { RecurrenceDialog } from "./cells/recurrence-dialog";

interface EventsTableProps {
  events: CalendarEvent[];
  calendars: CalendarInfo[];
  visibleColumns: ColumnKey[];
  selectedIds: Set<string>;
  onToggleSelect: (eventId: string) => void;
  onToggleAll: () => void;
  onUpdateEvent: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  duplicateGroups: Map<string, number>;
  loading: boolean;
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

function eventKey(event: CalendarEvent): string {
  return `${event.calendarId}:${event.id}`;
}

function isEditable(event: CalendarEvent, calendars: CalendarInfo[]): boolean {
  const cal = calendars.find((c) => c.id === event.calendarId);
  return cal?.accessRole === "owner" || cal?.accessRole === "writer";
}

const DUPLICATE_COLORS = [
  "bg-yellow-100 dark:bg-yellow-900/30",
  "bg-blue-100 dark:bg-blue-900/30",
  "bg-green-100 dark:bg-green-900/30",
  "bg-pink-100 dark:bg-pink-900/30",
  "bg-purple-100 dark:bg-purple-900/30",
];

function TimeCell({
  event,
  editable,
  onSave,
  onRecurrencePrompt,
}: {
  event: CalendarEvent;
  editable: boolean;
  onSave: EventsTableProps["onUpdateEvent"];
  onRecurrencePrompt: (callback: (mode: RecurrenceMode) => void) => void;
}) {
  const startDate = event.isAllDay
    ? new Date(event.start + "T00:00:00")
    : new Date(event.start);
  const endDate = event.isAllDay
    ? new Date(event.end + "T00:00:00")
    : new Date(event.end);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (event.isAllDay) {
    // Google Calendar end date is exclusive for all-day events,
    // so a single-day event has end = start + 1 day
    const diffDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) {
      return (
        <DateTimePopoverCell
          event={event}
          field="start"
          editable={editable}
          onSave={onSave}
          onRecurrencePrompt={onRecurrencePrompt}
        />
      );
    }
    // Multi-day all-day: show "Apr 4 – Apr 6" (subtract 1 day from exclusive end)
    const lastDay = new Date(endDate);
    lastDay.setDate(lastDay.getDate() - 1);
    return (
      <span className="flex items-center gap-1 whitespace-nowrap">
        <DateTimePopoverCell
          event={event}
          field="start"
          displayText={formatDate(startDate)}
          editable={editable}
          onSave={onSave}
          onRecurrencePrompt={onRecurrencePrompt}
        />
        <span className="text-muted-foreground">–</span>
        <DateTimePopoverCell
          event={event}
          field="end"
          displayText={formatDate(lastDay)}
          editable={editable}
          onSave={onSave}
          onRecurrencePrompt={onRecurrencePrompt}
        />
      </span>
    );
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();

  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {!sameDay && (
        <span className="text-muted-foreground">{formatDate(startDate)}</span>
      )}
      <DateTimePopoverCell
        event={event}
        field="start"
        editable={editable}
        onSave={onSave}
        onRecurrencePrompt={onRecurrencePrompt}
      />
      <span className="text-muted-foreground">–</span>
      {!sameDay && (
        <span className="text-muted-foreground">{formatDate(endDate)}</span>
      )}
      <DateTimePopoverCell
        event={event}
        field="end"
        editable={editable}
        onSave={onSave}
        onRecurrencePrompt={onRecurrencePrompt}
      />
    </span>
  );
}

export function EventsTable({
  events,
  calendars,
  visibleColumns,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onUpdateEvent,
  duplicateGroups,
  loading,
}: EventsTableProps) {
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceCallback, setRecurrenceCallback] = useState<
    ((mode: RecurrenceMode) => void) | null
  >(null);

  const handleRecurrencePrompt = useCallback(
    (callback: (mode: RecurrenceMode) => void) => {
      setRecurrenceCallback(() => callback);
      setRecurrenceDialogOpen(true);
    },
    []
  );

  function handleRecurrenceConfirm(mode: RecurrenceMode) {
    recurrenceCallback?.(mode);
    setRecurrenceCallback(null);
  }

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

  function renderCell(event: CalendarEvent, column: ColumnKey) {
    const editable = isEditable(event, calendars);

    switch (column) {
      case "calendar":
        return (
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: event.calendarColor }}
            />
            <span className="truncate max-w-[150px]">
              {event.calendarName}
            </span>
          </div>
        );

      case "summary":
        return (
          <InlineTextCell
            event={event}
            field="summary"
            editable={editable}
            onSave={onUpdateEvent}
            onRecurrencePrompt={handleRecurrencePrompt}
          />
        );

      case "location":
        return (
          <InlineTextCell
            event={event}
            field="location"
            editable={editable}
            onSave={onUpdateEvent}
            onRecurrencePrompt={handleRecurrencePrompt}
          />
        );

      case "description":
        return (
          <DescriptionPopoverCell
            event={event}
            editable={editable}
            onSave={onUpdateEvent}
            onRecurrencePrompt={handleRecurrencePrompt}
          />
        );

      case "time":
        return (
          <TimeCell
            event={event}
            editable={editable}
            onSave={onUpdateEvent}
            onRecurrencePrompt={handleRecurrencePrompt}
          />
        );

      case "status":
        return (
          <StatusDropdownCell
            event={event}
            editable={editable}
            onSave={onUpdateEvent}
            onRecurrencePrompt={handleRecurrencePrompt}
          />
        );

      case "recurring":
        return event.recurringEventId ? (
          <Badge variant="outline" className="text-xs">
            Recurring
          </Badge>
        ) : null;

      case "created":
        return formatDateTime(event.created);

      case "updated":
        return formatDateTime(event.updated);
    }
  }

  return (
    <>
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
                      {renderCell(event, col.key)}
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
      <RecurrenceDialog
        open={recurrenceDialogOpen}
        onOpenChange={setRecurrenceDialogOpen}
        onConfirm={handleRecurrenceConfirm}
      />
    </>
  );
}

export { eventKey };
