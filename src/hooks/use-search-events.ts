"use client";

import { useState, useEffect, useRef } from "react";
import type { CalendarEvent } from "@/lib/types/event";

export function useSearchEvents(query: string) {
  const [results, setResults] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(() => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      fetch(`/api/events/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setResults([]);
            setLoading(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [query]);

  return { results, loading };
}
