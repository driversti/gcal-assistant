"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRightLeft, GitCompareArrows } from "lucide-react";
import { MoveDialog } from "./move-dialog";
import type { CalendarInfo } from "@/lib/types/calendar";

interface BulkActionsBarProps {
  selectedCount: number;
  calendars: CalendarInfo[];
  onDelete: () => Promise<void>;
  onMove: (targetCalendarId: string) => Promise<void>;
  onCompare: () => void;
  isComparing: boolean;
}

export function BulkActionsBar({
  selectedCount,
  calendars,
  onDelete,
  onMove,
  onCompare,
  isComparing,
}: BulkActionsBarProps) {
  const [deleting, setDeleting] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  if (selectedCount === 0) return null;

  async function handleDelete() {
    if (!confirm(`Delete ${selectedCount} event(s)? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleting ? "Deleting..." : "Delete"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMoveDialogOpen(true)}
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Move
        </Button>
        {selectedCount >= 2 && (
          <Button
            variant={isComparing ? "secondary" : "outline"}
            size="sm"
            onClick={onCompare}
          >
            <GitCompareArrows className="mr-2 h-4 w-4" />
            {isComparing ? "Hide comparison" : "Compare"}
          </Button>
        )}
      </div>
      <MoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        calendars={calendars}
        onMove={onMove}
        selectedCount={selectedCount}
      />
    </>
  );
}
