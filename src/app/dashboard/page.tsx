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

  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(dateParam + "T12:00:00") : new Date();
  const dateString = toDateString(date);

  const { calendars, loading: calendarsLoading } = useCalendars();
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[] | null>(null);

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

  useEffect(() => {
    if (selectedCalendarIds !== null) {
      localStorage.setItem("gca:selectedCalendarIds", JSON.stringify(selectedCalendarIds));
    }
  }, [selectedCalendarIds]);

  const calendarIds = useMemo(() => {
    if (selectedCalendarIds !== null && selectedCalendarIds.length > 0) return selectedCalendarIds;
    return calendars.map((c) => c.id);
  }, [calendars, selectedCalendarIds]);

  const { events, loading: eventsLoading, refetch } = useEvents(dateString, calendarIds);

  const duplicateGroups = useMemo(() => detectDuplicates(events), [events]);

  const [aiCreateOpen, setAiCreateOpen] = useState(false);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [email, setEmail] = useState("");
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => setEmail(data.email ?? ""))
      .catch(() => {});
  }, []);

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
