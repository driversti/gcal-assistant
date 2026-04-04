# Unified Timeline Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual-layout dashboard (cards on mobile, table on desktop) with a single unified vertical timeline that works at every screen width.

**Architecture:** Top bar with date navigation and popovers replaces the sidebar. All-day events render as gradient banners at the top, timed events flow down a vertical time axis. A responsive edit panel (bottom sheet < 640px, side panel >= 640px) replaces both the table inline editing and full-screen mobile sheet. Three-dot menus on each card replace bulk actions and swipe gestures.

**Tech Stack:** Next.js 16 + React 19, Tailwind CSS v4 (oklch), shadcn/ui (Base UI variant — NOT Radix), react-day-picker v9, date-fns, lucide-react

**IMPORTANT caveats discovered in previous work:**
- `DropdownMenuTrigger` does NOT support `asChild` — apply styles directly to the trigger element
- react-day-picker v9 `classNames` prop replaces built-in class values (spread via `...classNames`); the `table` key does NOT apply to the rendered `<table>` element — use `[&_table]:w-full` CSS selector instead
- The Calendar component's root has `w-fit` by default — override with `root: "w-full"` in classNames
- Popover uses `@base-ui/react/popover`, not Radix — check `src/components/ui/popover.tsx` for API
- Logout API at `/api/auth/logout` only accepts POST method

---

### Task 1: Create event-card.tsx — the shared event card component

This is the atomic building block used by both all-day banners and timeline cards.

**Files:**
- Create: `src/components/dashboard/event-card.tsx`

- [ ] **Step 1: Create the EventCard component**

```tsx
// src/components/dashboard/event-card.tsx
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
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

This component is not yet used anywhere — just confirm no syntax/import errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/event-card.tsx
git commit -m "feat: add EventCard component for timeline view"
```

---

### Task 2: Create event-actions-menu.tsx — three-dot dropdown per card

**Files:**
- Create: `src/components/dashboard/event-actions-menu.tsx`

- [ ] **Step 1: Create the EventActionsMenu component**

```tsx
// src/components/dashboard/event-actions-menu.tsx
"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, ArrowRightLeft, Sparkles, Trash2 } from "lucide-react";
import { MoveDialog } from "./move-dialog";
import { AskAiDialog } from "./ask-ai-dialog";
import { RecurrenceDialog } from "./cells/recurrence-dialog";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { RecurrenceMode } from "@/lib/types/event-update";

interface EventActionsMenuProps {
  event: CalendarEvent;
  calendars: CalendarInfo[];
  onEdit: () => void;
  onDelete: (event: CalendarEvent, recurrenceMode?: RecurrenceMode) => Promise<void>;
  onMove: (event: CalendarEvent, targetCalendarId: string) => Promise<void>;
  onRefetch: () => void;
}

export function EventActionsMenu({
  event,
  calendars,
  onEdit,
  onDelete,
  onMove,
  onRefetch,
}: EventActionsMenuProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  function handleDeleteClick() {
    if (event.recurringEventId) {
      setRecurrenceOpen(true);
    } else {
      onDelete(event);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Move to...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAskAiOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleDeleteClick}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        calendars={calendars}
        onMove={async (targetId) => {
          await onMove(event, targetId);
          setMoveOpen(false);
        }}
        selectedCount={1}
      />

      <AskAiDialog
        event={askAiOpen ? event : null}
        open={askAiOpen}
        onOpenChange={setAskAiOpen}
        onSuccess={onRefetch}
      />

      <RecurrenceDialog
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        onConfirm={(mode) => {
          setRecurrenceOpen(false);
          onDelete(event, mode);
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/event-actions-menu.tsx
git commit -m "feat: add EventActionsMenu three-dot dropdown component"
```

---

### Task 3: Create timeline-view.tsx — all-day banners + vertical time axis

**Files:**
- Create: `src/components/dashboard/timeline-view.tsx`

- [ ] **Step 1: Create the TimelineView component**

```tsx
// src/components/dashboard/timeline-view.tsx
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
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/timeline-view.tsx
git commit -m "feat: add TimelineView with all-day banners and vertical time axis"
```

---

### Task 4: Create edit-panel.tsx — responsive edit panel (bottom sheet / side panel)

**Files:**
- Create: `src/components/dashboard/edit-panel.tsx`

- [ ] **Step 1: Create the EditPanel component**

```tsx
// src/components/dashboard/edit-panel.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { RecurrenceDialog } from "./cells/recurrence-dialog";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
import { format, parseISO } from "date-fns";

interface EditPanelProps {
  event: CalendarEvent | null;
  calendars: CalendarInfo[];
  open: boolean;
  onClose: () => void;
  onUpdateEvent: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  onDelete: (event: CalendarEvent, recurrenceMode?: RecurrenceMode) => Promise<void>;
}

export function EditPanel({
  event,
  calendars,
  open,
  onClose,
  onUpdateEvent,
  onDelete,
}: EditPanelProps) {
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);
  const [pendingFields, setPendingFields] = useState<EventUpdateFields | null>(null);

  useEffect(() => {
    if (event && open) {
      setSummary(event.summary);
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setStatus(event.status);
      if (event.isAllDay) {
        setStartDate(event.start.split("T")[0]);
        setEndDate(event.end.split("T")[0]);
        setStartTime("");
        setEndTime("");
      } else {
        const s = parseISO(event.start);
        const e = parseISO(event.end);
        setStartDate(format(s, "yyyy-MM-dd"));
        setStartTime(format(s, "HH:mm"));
        setEndDate(format(e, "yyyy-MM-dd"));
        setEndTime(format(e, "HH:mm"));
      }
    }
  }, [event, open]);

  if (!event || !open) return null;

  const calendarInfo = calendars.find((c) => c.id === event.calendarId);
  const isRecurring = !!event.recurringEventId;

  function buildFields(): EventUpdateFields {
    const fields: EventUpdateFields = {};
    if (summary !== event!.summary) fields.summary = summary;
    if (location !== (event!.location ?? ""))
      fields.location = location || null;
    if (description !== (event!.description ?? ""))
      fields.description = description || null;
    if (status !== event!.status) fields.status = status;

    if (event!.isAllDay) {
      if (startDate !== event!.start.split("T")[0])
        fields.start = { date: startDate };
      if (endDate !== event!.end.split("T")[0])
        fields.end = { date: endDate };
    } else {
      const origStart = format(parseISO(event!.start), "yyyy-MM-dd'T'HH:mm");
      const newStart = `${startDate}T${startTime}`;
      if (newStart !== origStart)
        fields.start = { dateTime: `${newStart}:00` };

      const origEnd = format(parseISO(event!.end), "yyyy-MM-dd'T'HH:mm");
      const newEnd = `${endDate}T${endTime}`;
      if (newEnd !== origEnd) fields.end = { dateTime: `${newEnd}:00` };
    }

    return fields;
  }

  async function handleSave(recurrenceMode?: RecurrenceMode) {
    const fields = pendingFields ?? buildFields();
    if (Object.keys(fields).length === 0) {
      onClose();
      return;
    }

    if (isRecurring && !recurrenceMode) {
      setPendingFields(fields);
      setPendingAction("save");
      setRecurrenceOpen(true);
      return;
    }

    setSaving(true);
    try {
      await onUpdateEvent(
        event!.id,
        event!.calendarId,
        fields,
        recurrenceMode,
        event!.recurringEventId
      );
      onClose();
    } finally {
      setSaving(false);
      setPendingFields(null);
      setPendingAction(null);
    }
  }

  async function handleDelete(recurrenceMode?: RecurrenceMode) {
    if (isRecurring && !recurrenceMode) {
      setPendingAction("delete");
      setRecurrenceOpen(true);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(event!, recurrenceMode);
      onClose();
    } finally {
      setDeleting(false);
      setPendingAction(null);
    }
  }

  function handleRecurrenceConfirm(mode: RecurrenceMode) {
    setRecurrenceOpen(false);
    if (pendingAction === "save") {
      handleSave(mode);
    } else if (pendingAction === "delete") {
      handleDelete(mode);
    }
  }

  const formContent = (
    <div className="flex flex-col gap-4 overflow-auto p-4">
      {/* Calendar badge */}
      {calendarInfo && (
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: calendarInfo.backgroundColor }}
          />
          <span className="text-sm text-muted-foreground">
            {calendarInfo.summary}
          </span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Title</label>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

      {/* Date/Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Start date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        {!event.isAllDay && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Start time</label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">End date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        {!event.isAllDay && (
          <div className="space-y-1">
            <label className="text-sm font-medium">End time</label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Location</label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add description"
          rows={4}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        >
          <option value="confirmed">Confirmed</option>
          <option value="tentative">Tentative</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={() => handleSave()} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => handleDelete()}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete Event"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop for narrow screens */}
      <div
        className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        onClick={onClose}
      />

      {/* Panel container */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-2xl border-t bg-background shadow-2xl sm:static sm:inset-auto sm:z-auto sm:max-h-none sm:w-[400px] sm:shrink-0 sm:rounded-none sm:rounded-l-lg sm:border-l sm:border-t-0 sm:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          {/* Drag handle (narrow screens only) */}
          <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-muted-foreground/30 sm:hidden" />
          <h2 className="text-base font-bold">Edit Event</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {formContent}
      </div>

      <RecurrenceDialog
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        onConfirm={handleRecurrenceConfirm}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/edit-panel.tsx
git commit -m "feat: add EditPanel — responsive bottom sheet / side panel"
```

---

### Task 5: Create top-bar.tsx — date navigation, filter popover, avatar dropdown

**Files:**
- Create: `src/components/dashboard/top-bar.tsx`

- [ ] **Step 1: Create the TopBar component**

```tsx
// src/components/dashboard/top-bar.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import type { CalendarInfo } from "@/lib/types/calendar";

interface TopBarProps {
  date: Date;
  dateString: string;
  onDateChange: (date: Date) => void;
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  totalCalendarCount: number;
  onCalendarToggle: (id: string) => void;
  email: string;
}

export function TopBar({
  date,
  dateString,
  onDateChange,
  calendars,
  selectedCalendarIds,
  totalCalendarCount,
  onCalendarToggle,
  email,
}: TopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(date);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const hiddenCount = totalCalendarCount - selectedCalendarIds.length;

  const initials = email
    .split("@")[0]
    .split(".")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  function handlePrevDay() {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev);
  }

  function handleNextDay() {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    onDateChange(next);
  }

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      {/* Prev day */}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handlePrevDay}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Date with calendar popover */}
      <Popover
        open={calendarOpen}
        onOpenChange={(open) => {
          setCalendarOpen(open);
          if (open) setDisplayMonth(date);
        }}
      >
        <PopoverTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent">
          {dateLabel}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onDateChange(d);
                setCalendarOpen(false);
              }
            }}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
          />
        </PopoverContent>
      </Popover>

      {/* Next day */}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleNextDay}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Today button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 shrink-0 text-xs"
        onClick={() => onDateChange(new Date())}
      >
        Today
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Filter popover */}
      <Popover>
        <PopoverTrigger className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <Filter className="h-4 w-4" />
          {hiddenCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {hiddenCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Calendars
          </div>
          <ScrollArea className="max-h-[250px]">
            <div className="flex flex-col gap-1">
              {calendars.map((cal) => (
                <label
                  key={cal.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedCalendarIds.includes(cal.id)}
                    onCheckedChange={() => onCalendarToggle(cal.id)}
                  />
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: cal.backgroundColor }}
                  />
                  <span className="truncate">{cal.summary}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer border-0 p-0">
          {initials}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/top-bar.tsx
git commit -m "feat: add TopBar with date nav, calendar filter popover, avatar dropdown"
```

---

### Task 6: Rewrite dashboard page.tsx to use the new components

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the dashboard page**

```tsx
// src/app/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCalendars } from "@/hooks/use-calendars";
import { useEvents } from "@/hooks/use-events";
import { TopBar } from "@/components/dashboard/top-bar";
import { TimelineView } from "@/components/dashboard/timeline-view";
import { EditPanel } from "@/components/dashboard/edit-panel";
import { AiCreateFab } from "@/components/dashboard/ai-create-fab";
import { AiCreateEventDialog } from "@/components/dashboard/ai-create-event-dialog";
import { detectDuplicates } from "@/lib/duplicates";
import type { CalendarEvent } from "@/lib/types/event";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Date from URL params or today
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(dateParam + "T12:00:00") : new Date();
  const dateString = toDateString(date);

  // Calendar state
  const { calendars, loading: calendarsLoading } = useCalendars();
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[] | null>(null);

  // Load saved selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("gca:selectedCalendarIds");
    if (saved) {
      try {
        setSelectedCalendarIds(JSON.parse(saved));
      } catch {
        setSelectedCalendarIds(null);
      }
    }
  }, []);

  // Persist selection to localStorage
  useEffect(() => {
    if (selectedCalendarIds !== null) {
      localStorage.setItem("gca:selectedCalendarIds", JSON.stringify(selectedCalendarIds));
    }
  }, [selectedCalendarIds]);

  const calendarIds = useMemo(() => {
    if (selectedCalendarIds !== null && selectedCalendarIds.length > 0) return selectedCalendarIds;
    return calendars.map((c) => c.id);
  }, [calendars, selectedCalendarIds]);

  // Events
  const { events, loading: eventsLoading, refetch } = useEvents(dateString, calendarIds);

  // Duplicate detection
  const duplicateGroups = useMemo(() => detectDuplicates(events), [events]);

  // AI Create Event dialog
  const [aiCreateOpen, setAiCreateOpen] = useState(false);

  // Edit panel
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // User email
  const [email, setEmail] = useState("");
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setEmail(data.email ?? ""))
      .catch(() => {});
  }, []);

  // Current hour for timeline highlighting
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  useEffect(() => {
    const interval = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(interval);
  }, []);

  function handleDateChange(newDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", toDateString(newDate));
    router.push(`/dashboard?${params.toString()}`);
  }

  function handleCalendarToggle(id: string) {
    setSelectedCalendarIds((prev) => {
      const currentIds = prev !== null && prev.length > 0 ? prev : calendars.map((c) => c.id);
      if (currentIds.includes(id)) {
        return currentIds.filter((cid) => cid !== id);
      }
      return [...currentIds, id];
    });
  }

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

  const handleDeleteEvent = useCallback(
    async (event: CalendarEvent, recurrenceMode?: RecurrenceMode) => {
      await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          events: [{
            id: event.id,
            calendarId: event.calendarId,
            recurringEventId: event.recurringEventId,
          }],
          recurrenceMode,
        }),
      });
      setEditingEvent(null);
      refetch();
    },
    [refetch]
  );

  const handleMoveEvent = useCallback(
    async (event: CalendarEvent, targetCalendarId: string) => {
      await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          events: [{ id: event.id, calendarId: event.calendarId }],
          targetCalendarId,
        }),
      });
      refetch();
    },
    [refetch]
  );

  const isEditOpen = !!editingEvent;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        date={date}
        dateString={dateString}
        onDateChange={handleDateChange}
        calendars={calendars}
        selectedCalendarIds={calendarIds}
        totalCalendarCount={calendars.length}
        onCalendarToggle={handleCalendarToggle}
        email={email}
      />

      {/* Main area: timeline + optional edit panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 overflow-auto p-4 ${isEditOpen ? "sm:mr-0" : ""}`}>
          <TimelineView
            events={events}
            calendars={calendars}
            duplicateGroups={duplicateGroups}
            loading={eventsLoading}
            currentHour={currentHour}
            onEditEvent={(event) => setEditingEvent(event)}
            onDeleteEvent={handleDeleteEvent}
            onMoveEvent={handleMoveEvent}
            onRefetch={refetch}
          />
        </div>

        {isEditOpen && (
          <EditPanel
            event={editingEvent}
            calendars={calendars}
            open={isEditOpen}
            onClose={() => setEditingEvent(null)}
            onUpdateEvent={handleUpdateEvent}
            onDelete={handleDeleteEvent}
          />
        )}
      </div>

      {/* AI Create Event */}
      <AiCreateFab onClick={() => setAiCreateOpen(true)} />
      <AiCreateEventDialog
        open={aiCreateOpen}
        onOpenChange={setAiCreateOpen}
        calendars={calendars}
        onSuccess={refetch}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update ai-create-fab.tsx to remove the `lg:` breakpoints**

Replace the current className in `src/components/dashboard/ai-create-fab.tsx`:

```tsx
// Change the className on the Button from:
"fixed bottom-6 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 lg:bottom-6 lg:right-6 lg:h-14 lg:w-14"
// To:
"fixed bottom-6 right-4 z-30 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
```

- [ ] **Step 3: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/dashboard/ai-create-fab.tsx
git commit -m "feat: rewrite dashboard page with unified timeline layout"
```

---

### Task 7: Delete old components

**Files:**
- Delete: `src/components/dashboard/calendar-panel.tsx`
- Delete: `src/components/dashboard/event-card-list.tsx`
- Delete: `src/components/dashboard/event-edit-sheet.tsx`
- Delete: `src/components/dashboard/events-table.tsx`
- Delete: `src/components/dashboard/bulk-actions-bar.tsx`
- Delete: `src/components/dashboard/segmented-control.tsx`
- Delete: `src/components/dashboard/column-toggle.tsx`
- Delete: `src/components/dashboard/date-picker.tsx`

- [ ] **Step 1: Delete old components**

```bash
cd /Users/driversti/Projects/gca
rm src/components/dashboard/calendar-panel.tsx
rm src/components/dashboard/event-card-list.tsx
rm src/components/dashboard/event-edit-sheet.tsx
rm src/components/dashboard/events-table.tsx
rm src/components/dashboard/bulk-actions-bar.tsx
rm src/components/dashboard/segmented-control.tsx
rm src/components/dashboard/column-toggle.tsx
rm src/components/dashboard/date-picker.tsx
```

- [ ] **Step 2: Check for any remaining imports of deleted files**

Run: `cd /Users/driversti/Projects/gca && grep -r "calendar-panel\|event-card-list\|event-edit-sheet\|events-table\|bulk-actions-bar\|segmented-control\|column-toggle\|date-picker" src/ --include="*.tsx" --include="*.ts"`

Expected: No output (no remaining imports). If any file still references deleted components, remove those imports.

- [ ] **Step 3: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
cd /Users/driversti/Projects/gca
git add -A src/components/dashboard/
git commit -m "chore: remove old dashboard components replaced by timeline redesign"
```

---

### Task 8: Simplify dashboard layout.tsx

The current layout has a flex column with an empty `<div>` wrapper left over from when Header was there. Simplify.

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Simplify layout**

Replace the entire content of `src/app/dashboard/layout.tsx` with:

```tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return <main className="h-screen overflow-hidden">{children}</main>;
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/driversti/Projects/gca && npx next build 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "chore: simplify dashboard layout wrapper"
```

---

### Task 9: Visual verification with Playwright

Since we cannot authenticate into the real dashboard via Playwright, create a temporary test page that renders the new components with mock data, verify layout at multiple viewport widths, then delete the test page.

**Files:**
- Create (temporary): `src/app/test-timeline/page.tsx`

- [ ] **Step 1: Create test page with mock data**

```tsx
// src/app/test-timeline/page.tsx
"use client";

import { useState } from "react";
import { TopBar } from "@/components/dashboard/top-bar";
import { TimelineView } from "@/components/dashboard/timeline-view";
import { EditPanel } from "@/components/dashboard/edit-panel";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";

const MOCK_CALENDARS: CalendarInfo[] = [
  { id: "work", summary: "Work", backgroundColor: "#0d9488", foregroundColor: "#fff", primary: true, accessRole: "owner" },
  { id: "personal", summary: "Personal", backgroundColor: "#f97316", foregroundColor: "#fff", primary: false, accessRole: "owner" },
  { id: "holidays", summary: "Holidays", backgroundColor: "#8b5cf6", foregroundColor: "#fff", primary: false, accessRole: "reader" },
];

const MOCK_EVENTS: CalendarEvent[] = [
  { id: "1", calendarId: "holidays", calendarName: "Holidays", calendarColor: "#8b5cf6", summary: "Easter Monday", description: null, location: null, start: "2026-04-06", end: "2026-04-07", isAllDay: true, status: "confirmed", htmlLink: "", created: "", updated: "" },
  { id: "2", calendarId: "work", calendarName: "Work", calendarColor: "#0d9488", summary: "Sprint 14 Review", description: "Review sprint deliverables", location: null, start: "2026-04-06", end: "2026-04-07", isAllDay: true, status: "confirmed", htmlLink: "", created: "", updated: "" },
  { id: "3", calendarId: "personal", calendarName: "Personal", calendarColor: "#f97316", summary: "Dentist Appointment", description: null, location: "Warsaw Dental Clinic", start: "2026-04-06", end: "2026-04-07", isAllDay: true, status: "confirmed", htmlLink: "", created: "", updated: "" },
  { id: "4", calendarId: "work", calendarName: "Work", calendarColor: "#0d9488", summary: "Team Standup", description: null, location: null, start: "2026-04-06T09:00:00+02:00", end: "2026-04-06T09:30:00+02:00", isAllDay: false, status: "confirmed", htmlLink: "", created: "", updated: "", recurringEventId: "rec1" },
  { id: "5", calendarId: "work", calendarName: "Work", calendarColor: "#0d9488", summary: "Design Review", description: "Review new timeline mockups", location: "Room 4B", start: "2026-04-06T10:00:00+02:00", end: "2026-04-06T11:00:00+02:00", isAllDay: false, status: "confirmed", htmlLink: "", created: "", updated: "" },
  { id: "6", calendarId: "personal", calendarName: "Personal", calendarColor: "#f97316", summary: "Lunch with Alex", description: null, location: "Cafe Nero, Mokotowska", start: "2026-04-06T12:00:00+02:00", end: "2026-04-06T13:00:00+02:00", isAllDay: false, status: "confirmed", htmlLink: "", created: "", updated: "" },
  { id: "7", calendarId: "work", calendarName: "Work", calendarColor: "#0d9488", summary: "1:1 with Manager", description: null, location: null, start: "2026-04-06T14:00:00+02:00", end: "2026-04-06T14:30:00+02:00", isAllDay: false, status: "confirmed", htmlLink: "", created: "", updated: "", recurringEventId: "rec2" },
  { id: "8", calendarId: "personal", calendarName: "Personal", calendarColor: "#f97316", summary: "Gym", description: null, location: "CityFit Mokotow", start: "2026-04-06T17:00:00+02:00", end: "2026-04-06T18:00:00+02:00", isAllDay: false, status: "confirmed", htmlLink: "", created: "", updated: "" },
];

const MOCK_DUPLICATES = new Map<string, number>([
  ["work:5", 0],
  ["personal:6", 0],
]);

export default function TestTimelinePage() {
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        date={new Date("2026-04-06T12:00:00")}
        dateString="2026-04-06"
        onDateChange={() => {}}
        calendars={MOCK_CALENDARS}
        selectedCalendarIds={["work", "personal", "holidays"]}
        totalCalendarCount={3}
        onCalendarToggle={() => {}}
        email="yurii.chekhotskyi@example.com"
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <TimelineView
            events={MOCK_EVENTS}
            calendars={MOCK_CALENDARS}
            duplicateGroups={MOCK_DUPLICATES}
            loading={false}
            currentHour={11}
            onEditEvent={(e) => setEditingEvent(e)}
            onDeleteEvent={async () => {}}
            onMoveEvent={async () => {}}
            onRefetch={() => {}}
          />
        </div>
        {editingEvent && (
          <EditPanel
            event={editingEvent}
            calendars={MOCK_CALENDARS}
            open={!!editingEvent}
            onClose={() => setEditingEvent(null)}
            onUpdateEvent={async () => {}}
            onDelete={async () => {}}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and take screenshots at multiple widths**

Use Playwright to navigate to `http://localhost:3000/test-timeline` and take screenshots at:
- 375px (phone)
- 768px (tablet)
- 1280px (laptop)
- 1920px (desktop)

Also test: click an event card to open the edit panel and screenshot at 375px and 1280px.

Verify:
- All-day banners render at the top with gradient backgrounds
- Timed events render with hour markers and vertical line
- No layout breaks or excessive whitespace at any width
- Edit panel is a bottom sheet on 375px, side panel on 1280px
- Top bar elements are all accessible at every width

- [ ] **Step 3: Fix any visual issues found**

Address layout problems revealed by screenshots.

- [ ] **Step 4: Delete test page**

```bash
rm -rf /Users/driversti/Projects/gca/src/app/test-timeline
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual adjustments from Playwright verification"
```

---

### Task 10: Clean up old design files and update .gitignore

**Files:**
- Delete: `designs/` directory (static HTML mockups from previous iteration)
- Modify: `.gitignore` — add `.superpowers/` if not present

- [ ] **Step 1: Delete old design mockups**

```bash
cd /Users/driversti/Projects/gca
rm -rf designs/
```

- [ ] **Step 2: Add .superpowers/ to .gitignore if missing**

Check if `.superpowers/` is in `.gitignore`. If not, add it:

```bash
grep -q '\.superpowers' .gitignore || echo '.superpowers/' >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old design mockups, gitignore .superpowers"
```
