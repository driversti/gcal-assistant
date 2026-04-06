"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RecurrenceMode } from "@/lib/types/event-update";

interface RecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: RecurrenceMode) => void;
  action?: "save" | "delete";
}

const RECURRENCE_OPTIONS: { value: RecurrenceMode; label: string; description: string }[] = [
  {
    value: "single",
    label: "Only this event",
    description: "Changes apply to this occurrence only",
  },
  {
    value: "thisAndFollowing",
    label: "This and following events",
    description: "Changes apply to this and all future occurrences",
  },
  {
    value: "all",
    label: "All events in the series",
    description: "Changes apply to every occurrence",
  },
];

export function RecurrenceDialog({
  open,
  onOpenChange,
  onConfirm,
  action = "save",
}: RecurrenceDialogProps) {
  const defaultMode: RecurrenceMode = action === "delete" ? "all" : "single";
  const [selected, setSelected] = useState<RecurrenceMode>(defaultMode);

  useEffect(() => {
    if (open) setSelected(defaultMode);
  }, [open, defaultMode]);

  function handleConfirm() {
    onConfirm(selected);
    onOpenChange(false);
    setSelected(defaultMode);
  }

  function handleCancel() {
    onOpenChange(false);
    setSelected(defaultMode);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "delete" ? "Delete recurring event" : "Edit recurring event"}
          </DialogTitle>
          <DialogDescription>
            This event is part of a series. {action === "delete"
              ? "Which events should be deleted?"
              : "How should this change be applied?"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-4">
          {RECURRENCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col rounded-md px-3 py-2 hover:bg-accent ${
                selected === opt.value ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="recurrenceMode"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{opt.label}</span>
                {selected === opt.value && (
                  <span className="ml-auto text-primary">&#10003;</span>
                )}
              </div>
              <span className="ml-0 text-xs text-muted-foreground">
                {opt.description}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
