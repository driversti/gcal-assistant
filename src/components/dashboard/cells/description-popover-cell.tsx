"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CalendarEvent } from "@/lib/types/event";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";

interface DescriptionPopoverCellProps {
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

export function DescriptionPopoverCell({
  event,
  editable,
  onSave,
  onRecurrencePrompt,
}: DescriptionPopoverCellProps) {
  const value = event.description ?? "";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setError(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open, value]);

  async function doSave(recurrenceMode?: RecurrenceMode) {
    if (draft === value) {
      setOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        event.id,
        event.calendarId,
        { description: draft || null },
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
    return (
      <span className="truncate block max-w-[200px]" title={value}>
        {value}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="group flex cursor-pointer items-center gap-1 max-w-[200px]"
        title={value}
      >
        <span className="truncate">{value || "Add description"}</span>
        <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            disabled={saving}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-y"
            placeholder="Add description..."
          />
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
              disabled={saving || draft === value}
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
