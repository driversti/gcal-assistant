"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CalendarInfo } from "@/lib/types/calendar";

interface CalendarFilterProps {
  calendars: CalendarInfo[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  loading: boolean;
}

export function CalendarFilter({
  calendars,
  selectedIds,
  onToggle,
  loading,
}: CalendarFilterProps) {
  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading calendars...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-sm font-medium">Calendars</h3>
      <ScrollArea className="max-h-[300px]">
        <div className="flex flex-col gap-1">
          {calendars.map((cal) => (
            <label
              key={cal.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selectedIds.includes(cal.id)}
                onCheckedChange={() => onToggle(cal.id)}
              />
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span className="truncate">{cal.summary}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
