"use client";

import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { CalendarEvent } from "@/lib/types/event";
import { format, parseISO } from "date-fns";

interface EventCardProps {
  event: CalendarEvent;
  variant: "allday" | "timed";
  isDuplicate: boolean;
  onTap: () => void;
  actionMenu: React.ReactNode;
}

export function EventCard({
  event,
  variant,
  isDuplicate,
  onTap,
  actionMenu,
}: EventCardProps) {
  if (variant === "allday") {
    return (
      <div
        onClick={onTap}
        className="flex cursor-pointer items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 transition-colors hover:brightness-95"
        style={{
          borderLeftColor: event.calendarColor,
          background: `linear-gradient(90deg, ${event.calendarColor}26, transparent)`,
        }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: event.calendarColor }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {event.summary}
        </span>
        {isDuplicate && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-400/50 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
          >
            DUP
          </Badge>
        )}
        {event.recurringEventId && (
          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
            Recurring
          </Badge>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {event.calendarName}
        </span>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {actionMenu}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onTap}
      className="flex cursor-pointer gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50"
      style={{ borderLeftWidth: 3, borderLeftColor: event.calendarColor }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight">
          {event.summary}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {format(parseISO(event.start), "HH:mm")} –{" "}
            {format(parseISO(event.end), "HH:mm")}
          </span>
          <span>{event.calendarName}</span>
        </div>
        {event.location && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {isDuplicate && (
            <Badge
              variant="outline"
              className="border-amber-400/50 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
            >
              DUP
            </Badge>
          )}
          {event.recurringEventId && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Recurring
            </Badge>
          )}
        </div>
      </div>
      <div className="shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
        {actionMenu}
      </div>
    </div>
  );
}
