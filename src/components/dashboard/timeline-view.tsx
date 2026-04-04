"use client";

import { useMemo } from "react";
import { EventCard } from "./event-card";
import { EventActionsMenu } from "./event-actions-menu";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { RecurrenceMode } from "@/lib/types/event-update";
import { parseISO } from "date-fns";

interface TimelineViewProps {
  events: CalendarEvent[];
  calendars: CalendarInfo[];
  duplicateGroups: Map<string, number>;
  loading: boolean;
  currentHour: number;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent, recurrenceMode?: RecurrenceMode) => Promise<void>;
  onMoveEvent: (event: CalendarEvent, targetCalendarId: string) => Promise<void>;
  onRefetch: () => void;
}

function eventKey(event: CalendarEvent): string {
  return `${event.calendarId}:${event.id}`;
}

/** Group timed events by their start hour. Returns entries sorted by hour. */
function groupByHour(
  events: CalendarEvent[]
): { hour: number; events: CalendarEvent[] }[] {
  const map = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const h = parseISO(e.start).getHours();
    if (!map.has(h)) map.set(h, []);
    map.get(h)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, events]) => ({ hour, events }));
}

export function TimelineView({
  events,
  calendars,
  duplicateGroups,
  loading,
  currentHour,
  onEditEvent,
  onDeleteEvent,
  onMoveEvent,
  onRefetch,
}: TimelineViewProps) {
  const allDayEvents = useMemo(
    () => events.filter((e) => e.isAllDay),
    [events]
  );
  const timedEvents = useMemo(
    () => events.filter((e) => !e.isAllDay),
    [events]
  );
  const hourGroups = useMemo(() => groupByHour(timedEvents), [timedEvents]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Loading events...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-center text-muted-foreground">
          <div className="text-lg font-medium">No events</div>
          <div className="mt-1 text-sm">Nothing scheduled for this day</div>
        </div>
      </div>
    );
  }

  function renderActionMenu(event: CalendarEvent) {
    return (
      <EventActionsMenu
        event={event}
        calendars={calendars}
        onEdit={() => onEditEvent(event)}
        onDelete={onDeleteEvent}
        onMove={onMoveEvent}
        onRefetch={onRefetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* All-day banners */}
      {allDayEvents.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            All Day
          </div>
          <div className="flex flex-col gap-1.5">
            {allDayEvents.map((event) => (
              <EventCard
                key={eventKey(event)}
                event={event}
                variant="allday"
                isDuplicate={duplicateGroups.has(eventKey(event))}
                onTap={() => onEditEvent(event)}
                actionMenu={renderActionMenu(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider between all-day and timed */}
      {allDayEvents.length > 0 && timedEvents.length > 0 && (
        <div className="h-px bg-border" />
      )}

      {/* Vertical timeline */}
      {hourGroups.length > 0 && (
        <div className="flex flex-col">
          {hourGroups.map(({ hour, events: hourEvents }, groupIdx) => {
            const isPast = hour < currentHour;
            const isCurrent = hour === currentHour;
            const isLast = groupIdx === hourGroups.length - 1;

            return (
              <div key={hour} className="flex gap-3">
                {/* Hour marker + vertical line */}
                <div className="flex w-10 shrink-0 flex-col items-center">
                  <span
                    className={`text-xs font-bold ${
                      isCurrent
                        ? "text-primary"
                        : isPast
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground"
                    }`}
                  >
                    {String(hour).padStart(2, "0")}
                  </span>
                  {!isLast && (
                    <div
                      className={`mt-1 w-0.5 flex-1 rounded-full ${
                        isPast ? "bg-primary/40" : "bg-border"
                      }`}
                    />
                  )}
                </div>

                {/* Event cards for this hour */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-4">
                  {hourEvents.map((event) => (
                    <EventCard
                      key={eventKey(event)}
                      event={event}
                      variant="timed"
                      isDuplicate={duplicateGroups.has(eventKey(event))}
                      onTap={() => onEditEvent(event)}
                      actionMenu={renderActionMenu(event)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
