"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowRightLeft } from "lucide-react";
import { MoveDialog } from "./move-dialog";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import { format, parseISO } from "date-fns";

interface EventCardListProps {
  events: CalendarEvent[];
  calendars: CalendarInfo[];
  duplicateGroups: Map<string, number>;
  onDeleteSingle: (event: CalendarEvent) => Promise<void>;
  onMoveSingle: (event: CalendarEvent, targetCalendarId: string) => Promise<void>;
  onSelectEvent: (event: CalendarEvent) => void;
}

function eventKey(event: CalendarEvent): string {
  return `${event.calendarId}:${event.id}`;
}

function getTimeGroup(event: CalendarEvent): string {
  if (event.isAllDay) return "All Day";
  const hour = parseISO(event.start).getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function groupEvents(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  const order = ["All Day", "Morning", "Afternoon", "Evening"];
  for (const key of order) groups.set(key, []);
  for (const event of events) {
    const group = getTimeGroup(event);
    groups.get(group)!.push(event);
  }
  for (const [key, val] of groups) {
    if (val.length === 0) groups.delete(key);
  }
  return groups;
}

function SwipeableCard({
  event,
  duplicateGroup,
  onTap,
  onDelete,
  onMoveStart,
}: {
  event: CalendarEvent;
  duplicateGroup: number | undefined;
  onTap: () => void;
  onDelete: () => void;
  onMoveStart: () => void;
}) {
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(0);
  const didSwipe = useRef(false);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) { setSwiped(true); didSwipe.current = true; }
    else if (diff < -60) { setSwiped(false); didSwipe.current = true; }
  }

  const isDuplicate = duplicateGroup !== undefined;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind the card */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={onMoveStart}
          className="flex w-16 items-center justify-center bg-primary text-primary-foreground"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="flex w-16 items-center justify-center bg-destructive text-white"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Card content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!swiped && !didSwipe.current) onTap(); }}
        className={`relative flex gap-3 rounded-2xl border bg-card p-3.5 transition-transform duration-200 ${
          swiped ? "-translate-x-32" : "translate-x-0"
        } ${isDuplicate ? "border-amber-400/30 dark:border-amber-500/20" : "border-border"}`}
      >
        {/* Time column */}
        <div className="min-w-[48px] shrink-0 text-center">
          {event.isAllDay ? (
            <span className="text-xs font-semibold text-primary">All Day</span>
          ) : (
            <>
              <div className="text-sm font-bold">
                {format(parseISO(event.start), "HH:mm")}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {format(parseISO(event.end), "HH:mm")}
              </div>
            </>
          )}
        </div>

        {/* Color bar */}
        <div
          className="w-[3px] shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: event.calendarColor }}
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">
            {event.summary}
          </div>
          {event.location && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              📍 {event.location}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {event.calendarName}
            </Badge>
            {event.recurringEventId && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                🔄 Recurring
              </Badge>
            )}
            {isDuplicate && (
              <Badge
                variant="outline"
                className="border-amber-400/50 text-[10px] px-1.5 py-0 text-amber-600 dark:text-amber-400"
              >
                ⚠️ Duplicate
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventCardList({
  events,
  calendars,
  duplicateGroups,
  onDeleteSingle,
  onMoveSingle,
  onSelectEvent,
}: EventCardListProps) {
  const [moveEvent, setMoveEvent] = useState<CalendarEvent | null>(null);
  const groups = groupEvents(events);

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      {events.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No events for this day
        </div>
      )}

      {Array.from(groups.entries()).map(([group, groupEvents]) => (
        <div key={group}>
          <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {group}
          </div>
          <div className="flex flex-col gap-2">
            {groupEvents.map((event) => {
              const key = eventKey(event);
              return (
                <SwipeableCard
                  key={key}
                  event={event}
                  duplicateGroup={duplicateGroups.get(key)}
                  onTap={() => onSelectEvent(event)}
                  onDelete={() => onDeleteSingle(event)}
                  onMoveStart={() => setMoveEvent(event)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* MoveDialog for single event */}
      {moveEvent && (
        <MoveDialog
          open
          onOpenChange={(open) => !open && setMoveEvent(null)}
          calendars={calendars}
          onMove={async (targetId) => {
            await onMoveSingle(moveEvent, targetId);
            setMoveEvent(null);
          }}
          selectedCount={1}
        />
      )}
    </div>
  );
}
