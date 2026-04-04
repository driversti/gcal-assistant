"use client";

import { useState, useEffect, useMemo } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CalendarEvent } from "@/lib/types/event";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";

interface DateTimePopoverCellProps {
  event: CalendarEvent;
  field: "start" | "end";
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

function formatTime(dateStr: string, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getTimeFromISO(iso: string): { hour: string; minute: string } {
  const d = new Date(iso);
  return {
    hour: String(d.getHours()).padStart(2, "0"),
    minute: String(d.getMinutes()).padStart(2, "0"),
  };
}

function getDateFromString(dateStr: string): Date {
  if (dateStr.length === 10) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateTimePopoverCell({
  event,
  field,
  editable,
  onSave,
  onRecurrencePrompt,
}: DateTimePopoverCellProps) {
  const dateStr = field === "start" ? event.start : event.end;
  const displayValue = formatTime(dateStr, event.isAllDay);

  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    getDateFromString(dateStr)
  );
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");
  const [isAllDay, setIsAllDay] = useState(event.isAllDay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedDate(getDateFromString(dateStr));
      setIsAllDay(event.isAllDay);
      setError(null);
      if (!event.isAllDay) {
        const time = getTimeFromISO(dateStr);
        setHour(time.hour);
        setMinute(time.minute);
      } else {
        setHour("00");
        setMinute("00");
      }
    }
  }, [open, dateStr, event.isAllDay]);

  const allDayChanged = isAllDay !== event.isAllDay;

  const updatedFields = useMemo((): EventUpdateFields => {
    const dateOnly = toDateString(selectedDate);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (isAllDay) {
      // When toggling to all-day, send both start and end as date-only
      // so Google Calendar doesn't reject mismatched formats
      if (allDayChanged) {
        const startDate = field === "start" ? dateOnly : toDateString(getDateFromString(event.start));
        const endDate = field === "end" ? dateOnly : toDateString(getDateFromString(event.end));
        return {
          start: { date: startDate },
          end: { date: endDate },
        };
      }
      return {
        [field]: { date: dateOnly },
      };
    }

    const dateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      parseInt(hour, 10),
      parseInt(minute, 10)
    ).toISOString();

    // When toggling from all-day to timed, send both fields
    if (allDayChanged) {
      const otherField = field === "start" ? "end" : "start";
      const otherDateStr = field === "start" ? event.end : event.start;
      const otherDate = getDateFromString(otherDateStr);
      const otherDateTime = new Date(
        otherDate.getFullYear(), otherDate.getMonth(), otherDate.getDate(),
        field === "start" ? 1 : 0, 0
      ).toISOString();
      return {
        [field]: { dateTime, timeZone: tz },
        [otherField]: { dateTime: otherDateTime, timeZone: tz },
      };
    }

    return {
      [field]: { dateTime, timeZone: tz },
    };
  }, [selectedDate, hour, minute, isAllDay, field, allDayChanged, event.start, event.end]);

  const hasChanges = useMemo(() => {
    const origDate = getDateFromString(dateStr);
    const dateChanged =
      toDateString(selectedDate) !== toDateString(origDate);
    const allDayChanged = isAllDay !== event.isAllDay;

    if (dateChanged || allDayChanged) return true;

    if (!isAllDay && !event.isAllDay) {
      const origTime = getTimeFromISO(dateStr);
      return hour !== origTime.hour || minute !== origTime.minute;
    }

    return false;
  }, [selectedDate, hour, minute, isAllDay, dateStr, event.isAllDay]);

  async function doSave(recurrenceMode?: RecurrenceMode) {
    setSaving(true);
    setError(null);
    try {
      await onSave(
        event.id,
        event.calendarId,
        updatedFields,
        recurrenceMode,
        event.recurringEventId
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (event.recurringEventId) {
      onRecurrencePrompt((mode) => doSave(mode));
    } else {
      doSave();
    }
  }

  if (!editable) {
    return <span>{displayValue}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="group flex cursor-pointer items-center gap-1">
        <span>{displayValue}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-3 p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            initialFocus
          />

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isAllDay}
              onCheckedChange={(checked) => setIsAllDay(checked === true)}
            />
            All day
          </label>

          {!isAllDay && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="23"
                value={hour}
                onChange={(e) =>
                  setHour(e.target.value.padStart(2, "0").slice(-2))
                }
                className="w-14 rounded border border-input bg-background px-2 py-1 text-center text-sm"
              />
              <span className="text-muted-foreground">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minute}
                onChange={(e) =>
                  setMinute(e.target.value.padStart(2, "0").slice(-2))
                }
                className="w-14 rounded border border-input bg-background px-2 py-1 text-center text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
