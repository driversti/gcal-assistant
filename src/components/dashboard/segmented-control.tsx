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
