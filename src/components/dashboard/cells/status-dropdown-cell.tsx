"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/lib/types/event";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "tentative", label: "Tentative" },
  { value: "cancelled", label: "Cancelled" },
] as const;

interface StatusDropdownCellProps {
  event: CalendarEvent;
  editable: boolean;
  onSave: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  onRecurrencePrompt: (
    callback: (mode: RecurrenceMode) => void
  ) => void;
}

export function StatusDropdownCell({
  event,
  editable,
  onSave,
  onRecurrencePrompt,
}: StatusDropdownCellProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  async function doSave(newStatus: string, recurrenceMode?: RecurrenceMode) {
    if (newStatus === event.status) return;

    setSaving(true);
    setError(null);
    try {
      await onSave(
        event.id,
        event.calendarId,
        { status: newStatus },
        recurrenceMode,
        event.recurringEventId
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleSelect(newStatus: string) {
    if (newStatus === event.status) return;

    if (event.recurringEventId) {
      onRecurrencePrompt((mode) => doSave(newStatus, mode));
    } else {
      doSave(newStatus);
    }
  }

  if (!editable) {
    return <span>{event.status}</span>;
  }

  if (saving) {
    return (
      <div className="flex items-center gap-1">
        <span>{event.status}</span>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-accent"
        title={error ?? "Click to change status"}
      >
        <Badge
          variant="outline"
          className={error ? "border-destructive text-destructive" : ""}
        >
          {event.status}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={event.status === opt.value ? "bg-accent" : ""}
          >
            {opt.label}
            {event.status === opt.value && (
              <span className="ml-auto">&#10003;</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
