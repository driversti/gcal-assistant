"use client";

import { useState, useEffect } from "react";
import type { CalendarInfo } from "@/lib/types/calendar";

export function useCalendars() {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCalendars() {
      try {
        const res = await fetch("/api/calendars");
        if (res.ok) {
          const data = await res.json();
          setCalendars(data);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchCalendars();
  }, []);

  return { calendars, loading };
}
