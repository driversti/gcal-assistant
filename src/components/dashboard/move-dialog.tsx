"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarInfo } from "@/lib/types/calendar";

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: CalendarInfo[];
  onMove: (targetCalendarId: string) => Promise<void>;
  selectedCount: number;
}

export function MoveDialog({
  open,
  onOpenChange,
  calendars,
  onMove,
  selectedCount,
}: MoveDialogProps) {
  const [targetId, setTargetId] = useState<string>("");
  const [moving, setMoving] = useState(false);

  // Only show calendars with write access
  const writableCalendars = calendars.filter(
    (c) => c.accessRole === "owner" || c.accessRole === "writer"
  );

  async function handleMove() {
    if (!targetId) return;
    setMoving(true);
    try {
      await onMove(targetId);
      onOpenChange(false);
      setTargetId("");
    } finally {
      setMoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {selectedCount} event(s)</DialogTitle>
          <DialogDescription>
            Select the target calendar to move the selected events to.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-4">
          {writableCalendars.map((cal) => (
            <label
              key={cal.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent ${
                targetId === cal.id ? "bg-accent" : ""
              }`}
            >
              <input
                type="radio"
                name="targetCalendar"
                value={cal.id}
                checked={targetId === cal.id}
                onChange={() => setTargetId(cal.id)}
                className="sr-only"
              />
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span>{cal.summary}</span>
              {targetId === cal.id && (
                <span className="ml-auto text-primary">&#10003;</span>
              )}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!targetId || moving}>
            {moving ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
