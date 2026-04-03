"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCalendars } from "@/hooks/use-calendars";
import { useEvents } from "@/hooks/use-events";
import { CalendarFilter } from "@/components/dashboard/calendar-filter";
import { DatePicker } from "@/components/dashboard/date-picker";
import { EventsTable, eventKey } from "@/components/dashboard/events-table";
import {
  ColumnToggle,
  DEFAULT_COLUMNS,
  type ColumnKey,
} from "@/components/dashboard/column-toggle";
import { BulkActionsBar } from "@/components/dashboard/bulk-actions-bar";
import { EventComparison } from "@/components/dashboard/event-comparison";
import { detectDuplicates } from "@/lib/duplicates";

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
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  // Auto-select all calendars when they load
  const calendarIds = useMemo(() => {
    if (selectedCalendarIds.length > 0) return selectedCalendarIds;
    return calendars.map((c) => c.id);
  }, [calendars, selectedCalendarIds]);

  // Events
  const { events, loading: eventsLoading, refetch } = useEvents(dateString, calendarIds);

  // Column visibility
  const [visibleColumns, setVisibleColumns] =
    useState<ColumnKey[]>(DEFAULT_COLUMNS);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isComparing, setIsComparing] = useState(false);

  // Duplicate detection
  const duplicateGroups = useMemo(() => detectDuplicates(events), [events]);

  function handleDateChange(newDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", toDateString(newDate));
    router.push(`/dashboard?${params.toString()}`);
    setSelectedIds(new Set());
    setIsComparing(false);
  }

  function handleCalendarToggle(id: string) {
    setSelectedCalendarIds((prev) => {
      const currentIds = prev.length > 0 ? prev : calendars.map((c) => c.id);
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
    }));

    await fetch("/api/events/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", events: eventsToDelete }),
    });

    setSelectedIds(new Set());
    setIsComparing(false);
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
      setIsComparing(false);
      refetch();
    },
    [selectedEvents, refetch]
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r p-4">
        <CalendarFilter
          calendars={calendars}
          selectedIds={calendarIds}
          onToggle={handleCalendarToggle}
          loading={calendarsLoading}
        />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
        {/* Top bar: date picker + column toggle */}
        <div className="flex items-center justify-between">
          <DatePicker date={date} onDateChange={handleDateChange} />
          <ColumnToggle
            visibleColumns={visibleColumns}
            onToggle={handleColumnToggle}
          />
        </div>

        {/* Bulk actions */}
        <BulkActionsBar
          selectedCount={selectedIds.size}
          calendars={calendars}
          onDelete={handleDelete}
          onMove={handleMove}
          onCompare={() => setIsComparing(!isComparing)}
          isComparing={isComparing}
        />

        {/* Events table */}
        <EventsTable
          events={events}
          visibleColumns={visibleColumns}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          duplicateGroups={duplicateGroups}
          loading={eventsLoading}
        />

        {/* Comparison view */}
        {isComparing && selectedEvents.length >= 2 && (
          <EventComparison events={selectedEvents} />
        )}
      </div>
    </div>
  );
}
