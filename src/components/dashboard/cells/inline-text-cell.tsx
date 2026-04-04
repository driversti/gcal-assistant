"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Loader2 } from "lucide-react";
import type { CalendarEvent } from "@/lib/types/event";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";

interface InlineTextCellProps {
  event: CalendarEvent;
  field: "summary" | "location";
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

export function InlineTextCell({
  event,
  field,
  editable,
  onSave,
  onRecurrencePrompt,
}: InlineTextCellProps) {
  const value = field === "summary" ? event.summary : (event.location ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  // Auto-clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  async function doSave(recurrenceMode?: RecurrenceMode) {
    if (draft === value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        event.id,
        event.calendarId,
        { [field]: draft || (field === "summary" ? "" : null) },
        recurrenceMode,
        event.recurringEventId
      );
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    if (draft === value) {
      setEditing(false);
      return;
    }

    if (event.recurringEventId) {
      onRecurrencePrompt((mode) => doSave(mode));
    } else {
      doSave();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    } else if (e.key === "Enter") {
      inputRef.current?.blur();
    }
  }

  if (!editable) {
    return <span className="truncate" title={value}>{value || (field === "location" ? "" : "(No title)")}</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder={field === "summary" ? "(No title)" : "Add location"}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div
      className="group flex cursor-pointer items-center gap-1 truncate"
      onClick={() => setEditing(true)}
      title={error ?? value}
    >
      <span className={`truncate ${error ? "text-destructive" : ""}`}>
        {value || (field === "location" ? "" : "(No title)")}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 text-muted-foreground" />
    </div>
  );
}
