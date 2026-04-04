"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, ArrowRightLeft } from "lucide-react";
import { MoveDialog } from "./move-dialog";
import type { CalendarInfo } from "@/lib/types/calendar";

interface BulkActionsBarProps {
  selectedCount: number;
  calendars: CalendarInfo[];
  onDelete: () => Promise<void>;
  onMove: (targetCalendarId: string) => Promise<void>;
}

export function BulkActionsBar({
  selectedCount,
  calendars,
  onDelete,
  onMove,
}: BulkActionsBarProps) {
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  if (selectedCount === 0) return null;

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <>
      <div className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2 lg:flex">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleting ? "Deleting..." : "Delete"}
        </Button>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedCount} event(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMoveDialogOpen(true)}
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Move
        </Button>

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
