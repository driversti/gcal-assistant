"use client";

import { useState, useEffect, useCallback } from "react";
import type { CalendarEvent } from "@/lib/types/event";

export function useEvents(date: string, calendarIds: string[]) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!date || calendarIds.length === 0) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        date,
        calendarIds: calendarIds.join(","),
      });
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } finally {
      setLoading(false);
    }
  }, [date, calendarIds]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
