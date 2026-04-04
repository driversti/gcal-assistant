# Inline Event Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline editing to the events table so users can modify event fields directly in-cell or via popovers, with full recurring event support.

**Architecture:** Editable cell wrapper components (`InlineTextCell`, `DescriptionPopoverCell`, `DateTimePopoverCell`, `StatusDropdownCell`) replace static table cells for writable calendars. A shared `RecurrenceDialog` intercepts saves on recurring events. The existing `PATCH /api/events/[eventId]` route is extended to handle field updates alongside the existing move operation.

**Tech Stack:** Next.js 16, React 19, googleapis v171, shadcn/ui (popover, dialog, dropdown-menu, button, calendar), lucide-react, date-fns

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `src/lib/types/event-update.ts` | `EventUpdateFields` interface and `RecurrenceMode` type |
| `src/lib/google/update-event.ts` | `updateEvent()` function calling Google Calendar API `events.patch` / `events.get` |
| `src/components/dashboard/cells/inline-text-cell.tsx` | In-cell text input for summary/location |
| `src/components/dashboard/cells/description-popover-cell.tsx` | Popover with textarea for description |
| `src/components/dashboard/cells/date-time-popover-cell.tsx` | Popover with date picker + time inputs for start/end |
| `src/components/dashboard/cells/status-dropdown-cell.tsx` | Dropdown menu for status field |
| `src/components/dashboard/cells/recurrence-dialog.tsx` | Dialog asking single/thisAndFollowing/all before saving recurring events |

### Modified files

| File | Changes |
|---|---|
| `src/app/api/events/[eventId]/route.ts` | Extend PATCH to handle `fields` body for updates |
| `src/components/dashboard/events-table.tsx` | Add `calendars` and `onUpdateEvent` props; render editable cells |
| `src/app/dashboard/page.tsx` | Add `handleUpdateEvent`; pass `calendars` and handler to `EventsTable` |

---

## Task 1: Add `EventUpdateFields` type and `RecurrenceMode`

**Files:**
- Create: `src/lib/types/event-update.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/lib/types/event-update.ts

export interface EventUpdateFields {
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
}

export type RecurrenceMode = "single" | "thisAndFollowing" | "all";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/event-update.ts
git commit -m "feat: add EventUpdateFields type and RecurrenceMode"
```

---

## Task 2: Add `updateEvent()` Google API function

**Files:**
- Create: `src/lib/google/update-event.ts`

**Reference:** `src/lib/google/events.ts` for the existing pattern of creating `google.calendar({ version: "v3", auth })` per call.

- [ ] **Step 1: Create the update-event module**

```ts
// src/lib/google/update-event.ts

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { calendar_v3 } from "googleapis";
import type {
  EventUpdateFields,
  RecurrenceMode,
} from "@/lib/types/event-update";

/**
 * Build the Google API request body from our EventUpdateFields.
 * Only includes fields that are present (partial update).
 */
function toGoogleEventBody(
  fields: EventUpdateFields
): calendar_v3.Schema$Event {
  const body: calendar_v3.Schema$Event = {};

  if (fields.summary !== undefined) body.summary = fields.summary;
  if (fields.description !== undefined)
    body.description = fields.description ?? undefined;
  if (fields.location !== undefined)
    body.location = fields.location ?? undefined;
  if (fields.status !== undefined) body.status = fields.status;
  if (fields.start !== undefined) body.start = fields.start;
  if (fields.end !== undefined) body.end = fields.end;

  return body;
}

/**
 * Update an event's fields via Google Calendar API.
 *
 * recurrenceMode controls how recurring events are handled:
 * - "single" (default): patch just this instance
 * - "all": patch the series master (uses recurringEventId)
 * - "thisAndFollowing": not natively supported by Google — we patch
 *   this instance and all following instances individually
 */
export async function updateEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
  fields: EventUpdateFields,
  recurrenceMode: RecurrenceMode = "single",
  recurringEventId?: string
): Promise<void> {
  const calendarApi = google.calendar({ version: "v3", auth });
  const body = toGoogleEventBody(fields);

  if (recurrenceMode === "single" || !recurringEventId) {
    // Patch the single event instance
    await calendarApi.events.patch({
      calendarId,
      eventId,
      requestBody: body,
    });
    return;
  }

  if (recurrenceMode === "all") {
    // Patch the series master
    await calendarApi.events.patch({
      calendarId,
      eventId: recurringEventId,
      requestBody: body,
    });
    return;
  }

  // "thisAndFollowing": get all instances, find this one's index,
  // then patch this and all later instances individually.
  const { data } = await calendarApi.events.instances({
    calendarId,
    eventId: recurringEventId,
    maxResults: 2500,
  });

  const instances = data.items ?? [];
  const thisIndex = instances.findIndex((inst) => inst.id === eventId);
  if (thisIndex === -1) {
    // Fallback: just patch this instance
    await calendarApi.events.patch({
      calendarId,
      eventId,
      requestBody: body,
    });
    return;
  }

  const toUpdate = instances.slice(thisIndex);
  // Patch in parallel with concurrency limit
  const BATCH_SIZE = 10;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((inst) =>
        calendarApi.events.patch({
          calendarId,
          eventId: inst.id!,
          requestBody: body,
        })
      )
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/google/update-event.ts
git commit -m "feat: add updateEvent() Google Calendar API function"
```

---

## Task 3: Extend `PATCH /api/events/[eventId]` route

**Files:**
- Modify: `src/app/api/events/[eventId]/route.ts`

The existing PATCH handler only handles move operations. We extend it to also handle field updates. Disambiguation: if `fields` is present, it's an update; if `sourceCalendarId`/`targetCalendarId` is present, it's a move.

- [ ] **Step 1: Update the PATCH handler**

Replace the entire PATCH export in `src/app/api/events/[eventId]/route.ts` with:

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await request.json();

  // Field update
  if (body.fields) {
    if (!body.calendarId) {
      return NextResponse.json(
        { error: "Missing calendarId" },
        { status: 400 }
      );
    }

    try {
      await updateEvent(
        client,
        body.calendarId,
        eventId,
        body.fields,
        body.recurrenceMode,
        body.recurringEventId
      );
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update event";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Move (existing behavior)
  if (!body.sourceCalendarId || !body.targetCalendarId) {
    return NextResponse.json(
      { error: "Missing sourceCalendarId or targetCalendarId" },
      { status: 400 }
    );
  }

  await moveEvent(client, body.sourceCalendarId, eventId, body.targetCalendarId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Add the import**

Add at the top of the file:

```ts
import { updateEvent } from "@/lib/google/update-event";
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/[eventId]/route.ts
git commit -m "feat: extend PATCH route to handle event field updates"
```

---

## Task 4: Create `InlineTextCell` component

**Files:**
- Create: `src/components/dashboard/cells/inline-text-cell.tsx`

**Behavior:** Click a cell to enter edit mode. Shows `<input>` styled to match the table. Auto-saves on blur. Cancels on Escape. Shows spinner while saving. Disabled for read-only calendars.

- [ ] **Step 1: Create the component**

```tsx
// src/components/dashboard/cells/inline-text-cell.tsx

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

  // Sync draft when event data changes externally
  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

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
    return <span>{value || (field === "location" ? "" : "(No title)")}</span>;
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
      className="group flex cursor-pointer items-center gap-1"
      onClick={() => setEditing(true)}
      title={error ?? undefined}
    >
      <span className={error ? "text-destructive" : ""}>
        {value || (field === "location" ? "" : "(No title)")}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 text-muted-foreground" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/cells/inline-text-cell.tsx
git commit -m "feat: add InlineTextCell component for summary/location editing"
```

---

## Task 5: Create `StatusDropdownCell` component

**Files:**
- Create: `src/components/dashboard/cells/status-dropdown-cell.tsx`

**Behavior:** Click to open a dropdown with status options. Auto-saves on selection.

- [ ] **Step 1: Create the component**

```tsx
// src/components/dashboard/cells/status-dropdown-cell.tsx

"use client";

import { useState } from "react";
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
      <DropdownMenuTrigger asChild>
        <button
          className="cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-accent"
          title={error ?? "Click to change status"}
        >
          <Badge
            variant="outline"
            className={error ? "border-destructive text-destructive" : ""}
          >
            {event.status}
          </Badge>
        </button>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/cells/status-dropdown-cell.tsx
git commit -m "feat: add StatusDropdownCell component"
```

---

## Task 6: Create `DescriptionPopoverCell` component

**Files:**
- Create: `src/components/dashboard/cells/description-popover-cell.tsx`

**Behavior:** Click truncated text to open a popover with a textarea. Explicit Save/Cancel buttons.

- [ ] **Step 1: Create the component**

```tsx
// src/components/dashboard/cells/description-popover-cell.tsx

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

  // Reset draft when popover opens
  useEffect(() => {
    if (open) {
      setDraft(value);
      setError(null);
      // Focus after popover renders
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
      <PopoverTrigger asChild>
        <div
          className="group flex cursor-pointer items-center gap-1 max-w-[200px]"
          title={value}
        >
          <span className="truncate">{value || "Add description"}</span>
          <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 text-muted-foreground" />
        </div>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/cells/description-popover-cell.tsx
git commit -m "feat: add DescriptionPopoverCell component"
```

---

## Task 7: Create `DateTimePopoverCell` component

**Files:**
- Create: `src/components/dashboard/cells/date-time-popover-cell.tsx`

**Behavior:** Click date/time text to open a popover with date picker (shadcn Calendar), time inputs (hour:minute), and isAllDay toggle. Explicit Save/Cancel. Validates end >= start.

**Reference:** The shadcn `Calendar` component at `src/components/ui/calendar.tsx` wraps `react-day-picker`. The existing `DatePicker` at `src/components/dashboard/date-picker.tsx` shows how it's used. `date-fns` is available for date manipulation.

- [ ] **Step 1: Create the component**

```tsx
// src/components/dashboard/cells/date-time-popover-cell.tsx

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

/** Parse "HH:MM" from an ISO datetime string */
function getTimeFromISO(iso: string): { hour: string; minute: string } {
  const d = new Date(iso);
  return {
    hour: String(d.getHours()).padStart(2, "0"),
    minute: String(d.getMinutes()).padStart(2, "0"),
  };
}

/** Parse Date from either "YYYY-MM-DD" (all-day) or ISO datetime */
function getDateFromString(dateStr: string): Date {
  // All-day dates are "YYYY-MM-DD", timed are ISO
  if (dateStr.length === 10) {
    // Parse as local date, not UTC
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

/** Format a Date to "YYYY-MM-DD" */
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

  // Reset state when popover opens
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

  // Build the updated fields for both start and end
  const updatedFields = useMemo((): EventUpdateFields => {
    const dateOnly = toDateString(selectedDate);

    if (isAllDay) {
      return {
        [field]: { date: dateOnly },
        // When toggling to all-day, we need to send the isAllDay context
        // by using the date format (no dateTime)
      };
    }

    const dateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      parseInt(hour, 10),
      parseInt(minute, 10)
    ).toISOString();

    return {
      [field]: {
        dateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }, [selectedDate, hour, minute, isAllDay, field]);

  // Check if anything changed
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
      <PopoverTrigger asChild>
        <div className="group flex cursor-pointer items-center gap-1">
          <span>{displayValue}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-3 p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            initialFocus
          />

          {/* All-day toggle */}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isAllDay}
              onCheckedChange={(checked) => setIsAllDay(checked === true)}
            />
            All day
          </label>

          {/* Time inputs — hidden when all-day */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/cells/date-time-popover-cell.tsx
git commit -m "feat: add DateTimePopoverCell component"
```

---

## Task 8: Create `RecurrenceDialog` component

**Files:**
- Create: `src/components/dashboard/cells/recurrence-dialog.tsx`

**Behavior:** A dialog that appears before saving when editing a recurring event. Three radio options, Confirm/Cancel buttons.

- [ ] **Step 1: Create the component**

```tsx
// src/components/dashboard/cells/recurrence-dialog.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RecurrenceMode } from "@/lib/types/event-update";

interface RecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: RecurrenceMode) => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceMode; label: string; description: string }[] = [
  {
    value: "single",
    label: "Only this event",
    description: "Changes apply to this occurrence only",
  },
  {
    value: "thisAndFollowing",
    label: "This and following events",
    description: "Changes apply to this and all future occurrences",
  },
  {
    value: "all",
    label: "All events in the series",
    description: "Changes apply to every occurrence",
  },
];

export function RecurrenceDialog({
  open,
  onOpenChange,
  onConfirm,
}: RecurrenceDialogProps) {
  const [selected, setSelected] = useState<RecurrenceMode>("single");

  function handleConfirm() {
    onConfirm(selected);
    onOpenChange(false);
    setSelected("single");
  }

  function handleCancel() {
    onOpenChange(false);
    setSelected("single");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit recurring event</DialogTitle>
          <DialogDescription>
            This event is part of a series. How should this change be applied?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-4">
          {RECURRENCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col rounded-md px-3 py-2 hover:bg-accent ${
                selected === opt.value ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="recurrenceMode"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{opt.label}</span>
                {selected === opt.value && (
                  <span className="ml-auto text-primary">&#10003;</span>
                )}
              </div>
              <span className="ml-0 text-xs text-muted-foreground">
                {opt.description}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/cells/recurrence-dialog.tsx
git commit -m "feat: add RecurrenceDialog component for recurring event edits"
```

---

## Task 9: Integrate editable cells into `EventsTable`

**Files:**
- Modify: `src/components/dashboard/events-table.tsx`

**Changes:**
- Add `calendars` and `onUpdateEvent` props
- Import all editable cell components and `RecurrenceDialog`
- Add recurrence dialog state management
- Replace static cell rendering with editable cell components for editable columns
- Determine editability per event based on calendar `accessRole`

- [ ] **Step 1: Update the EventsTable component**

Replace the entire content of `src/components/dashboard/events-table.tsx` with:

```tsx
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
  // Recurrence dialog state
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

      case "start":
        return (
          <DateTimePopoverCell
            event={event}
            field="start"
            editable={editable}
            onSave={onUpdateEvent}
            onRecurrencePrompt={handleRecurrencePrompt}
          />
        );

      case "end":
        return (
          <DateTimePopoverCell
            event={event}
            field="end"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/events-table.tsx
git commit -m "feat: integrate editable cells into EventsTable"
```

---

## Task 10: Wire up dashboard page with `handleUpdateEvent`

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Changes:** Add `handleUpdateEvent` callback, pass `calendars` and handler to `EventsTable`.

- [ ] **Step 1: Add `handleUpdateEvent` and update `EventsTable` usage**

In `src/app/dashboard/page.tsx`, add the following import at the top:

```ts
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
```

Add the `handleUpdateEvent` callback after the existing `handleMove` callback (after line 142):

```ts
const handleUpdateEvent = useCallback(
  async (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => {
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarId,
        fields,
        recurrenceMode,
        recurringEventId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update event");
    }

    refetch();
  },
  [refetch]
);
```

Update the `<EventsTable>` JSX to pass the new props:

```tsx
<EventsTable
  events={events}
  calendars={calendars}
  visibleColumns={visibleColumns}
  selectedIds={selectedIds}
  onToggleSelect={handleToggleSelect}
  onToggleAll={handleToggleAll}
  onUpdateEvent={handleUpdateEvent}
  duplicateGroups={duplicateGroups}
  loading={eventsLoading}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: wire up handleUpdateEvent in dashboard page"
```

---

## Task 11: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/driversti/Projects/gca && npm run dev
```

- [ ] **Step 2: Verify inline text editing**

1. Sign in, navigate to a day with events on a writable calendar
2. Click on a summary cell — should enter edit mode with input
3. Change the text, click away — should auto-save (spinner visible)
4. Refresh the page — change should persist
5. Press Escape while editing — should cancel without saving

- [ ] **Step 3: Verify popover editing**

1. Click a start/end time — date-time popover should open
2. Change the date using the calendar, adjust time
3. Click Save — should update
4. Click a description cell — textarea popover should open
5. Edit text, click Save

- [ ] **Step 4: Verify status dropdown**

1. Click a status badge — dropdown should appear
2. Select a different status — should auto-save

- [ ] **Step 5: Verify recurring event dialog**

1. Find a recurring event (one with a `recurringEventId`)
2. Edit any field — the recurrence dialog should appear
3. Select "Only this event" and confirm
4. Verify the change was applied

- [ ] **Step 6: Verify read-only calendars**

1. If a read-only calendar is visible, verify those events show no hover effects and cells are not clickable

- [ ] **Step 7: Verify error handling**

1. Disconnect from the internet
2. Try to edit a field — should show error on the cell
3. Reconnect — next edit should work
