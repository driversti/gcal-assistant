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

  // Load saved selection from localStorage on mount
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

  // Use saved selection, or all calendars if nothing saved yet
  const calendarIds = useMemo(() => {
    if (selectedCalendarIds !== null && selectedCalendarIds.length > 0) return selectedCalendarIds;
    return calendars.map((c) => c.id);
  }, [calendars, selectedCalendarIds]);

  // Events
  const { events, loading: eventsLoading, refetch } = useEvents(dateString, calendarIds);

  // Column visibility
  const [visibleColumns, setVisibleColumns] =
    useState<ColumnKey[]>(DEFAULT_COLUMNS);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Duplicate detection
  const duplicateGroups = useMemo(() => detectDuplicates(events), [events]);

  // AI Create Event dialog
  const [aiCreateOpen, setAiCreateOpen] = useState(false);

  // Segment control
  const [activeSegment, setActiveSegment] = useState<Segment>("all");

  // Mobile event editing
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // User email (for CalendarPanel avatar)
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setEmail(data.email ?? ""))
      .catch(() => {});
  }, []);

  // Duplicate event keys set for fast lookup
  const duplicateEventKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const key of duplicateGroups.keys()) keys.add(key);
    return keys;
  }, [duplicateGroups]);

  // Filtered events based on active segment
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

  function handleDateChange(newDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", toDateString(newDate));
    router.push(`/dashboard?${params.toString()}`);
    setSelectedIds(new Set());
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

  function handleColumnToggle(key: ColumnKey) {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleToggleSelect(key: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleToggleAll() {
    const allKeys = events.map((e) => eventKey(e));
    const allSelected = allKeys.every((k) => selectedIds.has(k));
    setSelectedIds(allSelected ? new Set() : new Set(allKeys));
  }

  const selectedEvents = useMemo(
    () => events.filter((e) => selectedIds.has(eventKey(e))),
    [events, selectedIds]
  );

  const handleDelete = useCallback(async () => {
    const eventsToDelete = selectedEvents.map((e) => ({
      id: e.id,
      calendarId: e.calendarId,
      recurringEventId: e.recurringEventId,
    }));

    await fetch("/api/events/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", events: eventsToDelete }),
    });

    setSelectedIds(new Set());
    refetch();
  }, [selectedEvents, refetch]);

  const handleMove = useCallback(
    async (targetCalendarId: string) => {
      const eventsToMove = selectedEvents.map((e) => ({
        id: e.id,
        calendarId: e.calendarId,
      }));

      await fetch("/api/events/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          events: eventsToMove,
          targetCalendarId,
        }),
      });

      setSelectedIds(new Set());
      refetch();
    },
    [selectedEvents, refetch]
  );

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
}
