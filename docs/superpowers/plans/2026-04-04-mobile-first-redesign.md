# Mobile-First Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign GCA dashboard as mobile-first with Design 3 aesthetic (calendar + drawer), using cards on mobile and table on desktop, teal accent color, minimal header (avatar in calendar panel).

**Architecture:** Single breakpoint at `lg:` (1024px). Mobile shows vertical stack (collapsible calendar panel → segmented control → card list with swipe actions). Desktop shows side-by-side (calendar panel left → table with inline editing right). Both share same state from `page.tsx`. New components: `CalendarPanel`, `EventCardList`, `EventEditSheet`, `SegmentedControl`. Removed: `EventComparison`, `Header`, `CalendarFilter`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (Base UI), Lucide icons, date-fns, react-day-picker

**Spec:** `docs/superpowers/specs/2026-04-04-mobile-first-redesign.md`

---

### Task 1: Update color system — teal primary accent

**Files:**
- Modify: `src/app/globals.css:51-94` (`:root` and `.dark` blocks)

- [ ] **Step 1: Update light mode primary to teal**

In `src/app/globals.css`, replace the `:root` primary variables:

```css
/* old */
--primary: oklch(0.205 0 0);
--primary-foreground: oklch(0.985 0 0);

/* new */
--primary: oklch(0.45 0.16 170);
--primary-foreground: oklch(0.98 0 0);
```

- [ ] **Step 2: Update dark mode primary to teal**

In the `.dark` block of `src/app/globals.css`, replace:

```css
/* old */
--primary: oklch(0.922 0 0);
--primary-foreground: oklch(0.205 0 0);

/* new */
--primary: oklch(0.7 0.15 175);
--primary-foreground: oklch(0.15 0 0);
```

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

Open the app in browser — buttons, active states, and primary elements should now be teal instead of black/white.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "style: change primary accent from neutral to teal"
```

---

### Task 2: Create SegmentedControl component

**Files:**
- Create: `src/components/dashboard/segmented-control.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { CalendarEvent } from "@/lib/types/event";

export type Segment = "all" | "duplicates" | "allday";

interface SegmentedControlProps {
  events: CalendarEvent[];
  duplicateGroupCount: number;
  activeSegment: Segment;
  onSegmentChange: (segment: Segment) => void;
}

export function SegmentedControl({
  events,
  duplicateGroupCount,
  activeSegment,
  onSegmentChange,
}: SegmentedControlProps) {
  const allDayCount = events.filter((e) => e.isAllDay).length;

  const segments: { key: Segment; label: string; count: number }[] = [
    { key: "all", label: "All", count: events.length },
    { key: "duplicates", label: "Duplicates", count: duplicateGroupCount },
    { key: "allday", label: "All Day", count: allDayCount },
  ];

  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {segments.map((seg) => (
        <button
          key={seg.key}
          onClick={() => onSegmentChange(seg.key)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
            activeSegment === seg.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {seg.label} ({seg.count})
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/segmented-control.tsx
git commit -m "feat: add SegmentedControl component (All/Duplicates/All Day)"
```

---

### Task 3: Create CalendarPanel component

**Files:**
- Create: `src/components/dashboard/calendar-panel.tsx`

This replaces `header.tsx` and `calendar-filter.tsx`. Contains avatar dropdown, mini-calendar, calendar filter, and month navigation.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, LogOut, Moon, Sun } from "lucide-react";
import type { CalendarInfo } from "@/lib/types/calendar";

interface CalendarPanelProps {
  date: Date;
  onDateChange: (date: Date) => void;
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  onCalendarToggle: (id: string) => void;
  email: string;
  calendarsLoading: boolean;
}

export function CalendarPanel({
  date,
  onDateChange,
  calendars,
  selectedCalendarIds,
  onCalendarToggle,
  email,
  calendarsLoading,
}: CalendarPanelProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  async function handleLogout() {
    await fetch("/api/auth/logout");
    router.push("/");
  }

  const initials = email
    .split("@")[0]
    .split(".")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: Today + Avatar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="text-primary"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {initials}
            </button>
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

      {/* Mini Calendar (collapsible on mobile) */}
      <div>
        <button
          onClick={() => setCalendarExpanded(!calendarExpanded)}
          className="flex w-full items-center justify-between lg:pointer-events-none"
        >
          <span className="text-lg font-bold">
            {date.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="lg:hidden">
            {calendarExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            calendarExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0 lg:max-h-[400px] lg:opacity-100"
          }`}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onDateChange(d)}
            defaultMonth={date}
            className="mt-2"
          />
        </div>
      </div>

      {/* Calendar Filters */}
      <div>
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Calendars
          <span className="lg:hidden">
            {filtersExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            filtersExpanded ? "max-h-[300px] opacity-100 mt-2" : "max-h-0 opacity-0 lg:max-h-[300px] lg:opacity-100 lg:mt-2"
          }`}
        >
          <ScrollArea className="max-h-[250px]">
            <div className="flex flex-col gap-1">
              {calendarsLoading ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : (
                calendars.map((cal) => (
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
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/calendar-panel.tsx
git commit -m "feat: add CalendarPanel component (mini-cal + filters + avatar dropdown)"
```

---

### Task 4: Create EventCardList component (mobile event display)

**Files:**
- Create: `src/components/dashboard/event-card-list.tsx`

Mobile-only card list with swipe-to-reveal actions, grouped by time of day.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRightLeft } from "lucide-react";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
import { format, parseISO } from "date-fns";

interface EventCardListProps {
  events: CalendarEvent[];
  calendars: CalendarInfo[];
  duplicateGroups: Map<string, number>;
  onUpdateEvent: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  onDeleteSingle: (event: CalendarEvent) => Promise<void>;
  onMoveSingle: (event: CalendarEvent, targetCalendarId: string) => Promise<void>;
  onRefetch?: () => void;
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

function formatTime(event: CalendarEvent): string {
  if (event.isAllDay) return "All Day";
  const start = format(parseISO(event.start), "HH:mm");
  const end = format(parseISO(event.end), "HH:mm");
  return `${start} – ${end}`;
}

function groupEvents(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  const order = ["All Day", "Morning", "Afternoon", "Evening"];
  for (const key of order) groups.set(key, []);
  for (const event of events) {
    const group = getTimeGroup(event);
    groups.get(group)!.push(event);
  }
  // Remove empty groups
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

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) setSwiped(true);
    else if (diff < -60) setSwiped(false);
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
        onClick={() => !swiped && onTap()}
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
        <MoveDialogSingle
          event={moveEvent}
          calendars={calendars}
          onMove={onMoveSingle}
          onClose={() => setMoveEvent(null)}
        />
      )}
    </div>
  );
}

// Inline single-event move dialog
import { MoveDialog } from "./move-dialog";

function MoveDialogSingle({
  event,
  calendars,
  onMove,
  onClose,
}: {
  event: CalendarEvent;
  calendars: CalendarInfo[];
  onMove: (event: CalendarEvent, targetCalendarId: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <MoveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      calendars={calendars}
      onMove={async (targetId) => {
        await onMove(event, targetId);
        onClose();
      }}
      selectedCount={1}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/event-card-list.tsx
git commit -m "feat: add EventCardList with swipe actions for mobile"
```

---

### Task 5: Create EventEditSheet component (mobile editing)

**Files:**
- Create: `src/components/dashboard/event-edit-sheet.tsx`

Full-screen bottom sheet for editing an event on mobile.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
import { RecurrenceDialog } from "./cells/recurrence-dialog";
import { format, parseISO } from "date-fns";

interface EventEditSheetProps {
  event: CalendarEvent | null;
  calendars: CalendarInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateEvent: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  onDelete: (event: CalendarEvent) => Promise<void>;
}

export function EventEditSheet({
  event,
  calendars,
  open,
  onOpenChange,
  onUpdateEvent,
  onDelete,
}: EventEditSheetProps) {
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
      onOpenChange(false);
      return;
    }

    if (isRecurring && !recurrenceMode) {
      setPendingFields(fields);
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
      onOpenChange(false);
    } finally {
      setSaving(false);
      setPendingFields(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(event!);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background lg:hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold">Edit Event</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 overflow-auto p-4 pb-32">
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

          {/* Summary */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
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
        </div>

        {/* Bottom actions */}
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t bg-background p-4 lg:hidden">
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Event"}
          </Button>
        </div>
      </div>

      <RecurrenceDialog
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        onConfirm={(mode) => {
          setRecurrenceOpen(false);
          handleSave(mode);
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify RecurrenceDialog props match**

The `RecurrenceDialog` accepts `onConfirm` (not `onSelect`). The code above already uses the correct prop name. Verify by reading `src/components/dashboard/cells/recurrence-dialog.tsx` — props are `open`, `onOpenChange`, `onConfirm: (mode: RecurrenceMode) => void`.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/event-edit-sheet.tsx
git commit -m "feat: add EventEditSheet full-screen mobile editor"
```

---

### Task 6: Remove comparison, update BulkActionsBar (desktop only)

**Files:**
- Delete: `src/components/dashboard/event-comparison.tsx`
- Modify: `src/components/dashboard/bulk-actions-bar.tsx:15,28` (remove compare props)

- [ ] **Step 1: Delete event-comparison.tsx**

```bash
rm src/components/dashboard/event-comparison.tsx
```

- [ ] **Step 2: Remove compare props from BulkActionsBar**

In `src/components/dashboard/bulk-actions-bar.tsx`, update the props interface to remove `onCompare` and `isComparing`:

Remove from interface (around line 19-27):
```tsx
// Remove these two lines from the interface:
//   onCompare: () => void;
//   isComparing: boolean;
```

Remove from the destructured props (line 28):
```tsx
// Remove onCompare and isComparing from the destructuring
```

Remove the Compare button JSX (the conditional block that renders the GitCompareArrows button).

Remove the `GitCompareArrows` import from lucide-react.

- [ ] **Step 3: Wrap BulkActionsBar in desktop-only class**

Add `hidden lg:flex` to the outer container div (currently `flex items-center gap-2 ...`):

```tsx
<div className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 lg:flex">
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: Errors about `EventComparison` import in `page.tsx` — that's expected, we'll fix it in Task 7.

- [ ] **Step 5: Commit**

```bash
git add -u src/components/dashboard/event-comparison.tsx src/components/dashboard/bulk-actions-bar.tsx
git commit -m "refactor: remove comparison feature, make bulk actions desktop-only"
```

---

### Task 7: Remove Header, update layout.tsx

**Files:**
- Modify: `src/app/dashboard/layout.tsx` (remove Header import and rendering)

- [ ] **Step 1: Update layout.tsx**

Replace the full content of `src/app/dashboard/layout.tsx` with:

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

  return (
    <div className="flex h-screen flex-col">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

Note: We changed `overflow-auto` to `overflow-hidden` on `<main>` because the page itself will handle scrolling. The `email` prop will be fetched in `page.tsx` instead.

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "refactor: remove Header from dashboard layout"
```

---

### Task 8: Rewrite page.tsx — new responsive layout

**Files:**
- Modify: `src/app/dashboard/page.tsx` (full rewrite of imports, state, and JSX)

This is the largest task. We replace the sidebar + table layout with the responsive CalendarPanel + SegmentedControl + dual-view (cards on mobile, table on desktop).

- [ ] **Step 1: Update imports**

Replace the imports section (lines 1-22) of `src/app/dashboard/page.tsx` with:

```tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCalendars } from "@/hooks/use-calendars";
import { useEvents } from "@/hooks/use-events";
import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { DatePicker } from "@/components/dashboard/date-picker";
import { EventsTable, eventKey } from "@/components/dashboard/events-table";
import { ColumnToggle, DEFAULT_COLUMNS, type ColumnKey } from "@/components/dashboard/column-toggle";
import { BulkActionsBar } from "@/components/dashboard/bulk-actions-bar";
import { AiCreateFab } from "@/components/dashboard/ai-create-fab";
import { AiCreateEventDialog } from "@/components/dashboard/ai-create-event-dialog";
import { SegmentedControl, type Segment } from "@/components/dashboard/segmented-control";
import { EventCardList } from "@/components/dashboard/event-card-list";
import { EventEditSheet } from "@/components/dashboard/event-edit-sheet";
import { detectDuplicates } from "@/lib/duplicates";
import type { CalendarEvent } from "@/lib/types/event";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
```

- [ ] **Step 2: Update state variables**

Keep the existing state but add new ones and remove comparison. After the existing state block, the state section should be:

```tsx
// Keep existing:
const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[] | null>(null);
const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [sidebarOpen, setSidebarOpen] = useState(true);  // remove this — no longer needed
const [aiCreateOpen, setAiCreateOpen] = useState(false);

// Remove: isComparing state

// Add new:
const [activeSegment, setActiveSegment] = useState<Segment>("all");
const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
const [email, setEmail] = useState("");
```

Also add an effect to fetch the user email (since layout no longer passes it):

```tsx
useEffect(() => {
  fetch("/api/auth/session")
    .then((r) => r.json())
    .then((data) => setEmail(data.email ?? ""))
    .catch(() => {});
}, []);
```

- [ ] **Step 3: Add filtered events logic**

After the `duplicateGroups` memo, add:

```tsx
const duplicateEventKeys = useMemo(() => {
  const keys = new Set<string>();
  for (const key of duplicateGroups.keys()) keys.add(key);
  return keys;
}, [duplicateGroups]);

const filteredEvents = useMemo(() => {
  switch (activeSegment) {
    case "duplicates":
      return events.filter((e) => duplicateEventKeys.has(eventKey(e)));
    case "allday":
      return events.filter((e) => e.isAllDay);
    default:
      return events;
  }
}, [events, activeSegment, duplicateEventKeys]);
```

- [ ] **Step 4: Add single-event delete/move handlers for mobile**

```tsx
const handleDeleteSingle = useCallback(
  async (event: CalendarEvent) => {
    await fetch("/api/events/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        events: [{ id: event.id, calendarId: event.calendarId, recurringEventId: event.recurringEventId }],
      }),
    });
    refetch();
  },
  [refetch]
);

const handleMoveSingle = useCallback(
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
```

- [ ] **Step 5: Update handleDelete to remove isComparing reference**

In the existing `handleDelete` callback, remove the `setIsComparing(false)` line. Same for `handleMove`.

- [ ] **Step 6: Remove comparison-related code**

Remove: `isComparing` state, `selectedEvents` memo, the `EventComparison` import, and the `onCompare`/`isComparing` props from `BulkActionsBar`.

- [ ] **Step 7: Rewrite the JSX return**

Replace the entire return block (lines 204-287) with:

```tsx
return (
  <div className="flex h-full flex-col lg:flex-row">
    {/* Calendar Panel — top on mobile, left sidebar on desktop */}
    <div className="shrink-0 border-b p-4 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-auto">
      <CalendarPanel
        date={date}
        onDateChange={handleDateChange}
        calendars={calendars}
        selectedCalendarIds={calendarIds}
        onCalendarToggle={handleCalendarToggle}
        email={email}
        calendarsLoading={calendarsLoading}
      />
    </div>

    {/* Main content */}
    <div className="flex flex-1 flex-col gap-3 overflow-auto p-4 lg:p-6">
      {/* Desktop top bar: date picker + column toggle */}
      <div className="hidden items-center justify-between lg:flex">
        <DatePicker date={date} onDateChange={handleDateChange} />
        <ColumnToggle
          visibleColumns={visibleColumns}
          onToggle={handleColumnToggle}
        />
      </div>

      {/* Mobile date title */}
      <div className="lg:hidden">
        <h2 className="text-lg font-bold">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h2>
      </div>

      {/* Segmented control (both mobile and desktop) */}
      <SegmentedControl
        events={events}
        duplicateGroupCount={duplicateGroups.size}
        activeSegment={activeSegment}
        onSegmentChange={setActiveSegment}
      />

      {/* Desktop: bulk actions */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        calendars={calendars}
        onDelete={handleDelete}
        onMove={handleMove}
      />

      {/* Desktop: events table */}
      <div className="hidden lg:block">
        <EventsTable
          events={filteredEvents}
          calendars={calendars}
          visibleColumns={visibleColumns}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          onUpdateEvent={handleUpdateEvent}
          duplicateGroups={duplicateGroups}
          loading={eventsLoading}
          onRefetch={refetch}
        />
      </div>

      {/* Mobile: event card list */}
      <EventCardList
        events={filteredEvents}
        calendars={calendars}
        duplicateGroups={duplicateGroups}
        onUpdateEvent={handleUpdateEvent}
        onDeleteSingle={handleDeleteSingle}
        onMoveSingle={handleMoveSingle}
        onRefetch={refetch}
        onSelectEvent={(event) => setEditingEvent(event)}
      />
    </div>

    {/* Mobile edit sheet */}
    <EventEditSheet
      event={editingEvent}
      calendars={calendars}
      open={!!editingEvent}
      onOpenChange={(open) => !open && setEditingEvent(null)}
      onUpdateEvent={handleUpdateEvent}
      onDelete={handleDeleteSingle}
    />

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
```

- [ ] **Step 8: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors. Fix any mismatched prop names.

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: rewrite dashboard with responsive mobile-first layout"
```

---

### Task 9: Update AiCreateFab positioning

**Files:**
- Modify: `src/components/dashboard/ai-create-fab.tsx`

- [ ] **Step 1: Update the className**

Replace the className in `ai-create-fab.tsx` (line 17):

```tsx
// old
className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105"

// new
className="fixed bottom-6 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 lg:bottom-6 lg:right-6 lg:h-14 lg:w-14"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/ai-create-fab.tsx
git commit -m "style: responsive FAB positioning and teal color"
```

---

### Task 10: Clean up deleted files and unused imports

**Files:**
- Delete: `src/components/dashboard/calendar-filter.tsx`
- Delete: `src/components/layout/header.tsx` (only if no other files import it)

- [ ] **Step 1: Check for remaining imports of deleted components**

Run: `grep -r "calendar-filter\|CalendarFilter\|event-comparison\|EventComparison\|header\|Header" src/ --include="*.tsx" --include="*.ts" -l`

For each file that still imports a deleted component, remove the import.

- [ ] **Step 2: Delete the files**

```bash
rm src/components/dashboard/calendar-filter.tsx
rm src/components/layout/header.tsx
```

- [ ] **Step 3: Verify the full app builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove calendar-filter, header, and unused imports"
```

---

### Task 11: Manual verification

- [ ] **Step 1: Test mobile view**

Open browser, resize to <1024px width (or use device emulation for iPhone 14). Verify:
- Calendar panel at top with mini-calendar, Today button, avatar
- Tapping avatar opens dropdown with email, theme toggle, sign out
- Segmented control shows All/Duplicates/All Day with correct counts
- Event cards display with time, color bar, title, location, badges
- Swiping left on a card reveals Move and Delete buttons
- Tapping a card opens full-screen edit sheet
- Edit sheet has all fields, Save and Delete buttons work
- AI FAB visible in bottom-right corner

- [ ] **Step 2: Test desktop view**

Resize to ≥1024px. Verify:
- Calendar panel on left sidebar (~280px)
- Date picker and column toggle in top bar
- Segmented control below top bar
- Events table with inline editing
- Checkboxes and bulk actions bar work
- AI FAB in bottom-right

- [ ] **Step 3: Test responsive transition**

Slowly resize browser across 1024px boundary. Verify no layout breaks or doubled content.

- [ ] **Step 4: Test theme toggle**

Click avatar → toggle theme. Verify teal accent looks correct in both light and dark modes.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
