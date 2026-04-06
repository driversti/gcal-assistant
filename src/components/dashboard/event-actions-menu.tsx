"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, ArrowRightLeft, Sparkles, Trash2 } from "lucide-react";
import { MoveDialog } from "./move-dialog";
import { AskAiDialog } from "./ask-ai-dialog";
import { RecurrenceDialog } from "./cells/recurrence-dialog";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { RecurrenceMode } from "@/lib/types/event-update";

interface EventActionsMenuProps {
  event: CalendarEvent;
  calendars: CalendarInfo[];
  onEdit: () => void;
  onDelete: (event: CalendarEvent, recurrenceMode?: RecurrenceMode) => Promise<void>;
  onMove: (event: CalendarEvent, targetCalendarId: string) => Promise<void>;
  onRefetch: () => void;
}

export function EventActionsMenu({
  event,
  calendars,
  onEdit,
  onDelete,
  onMove,
  onRefetch,
}: EventActionsMenuProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);

  function handleDeleteClick() {
    if (event.recurringEventId) {
      setRecurrenceOpen(true);
    } else {
      onDelete(event);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Move to...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAskAiOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Enrich with AI
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleDeleteClick}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        calendars={calendars}
        onMove={async (targetId) => {
          await onMove(event, targetId);
          setMoveOpen(false);
        }}
        selectedCount={1}
      />

      <AskAiDialog
        event={askAiOpen ? event : null}
        open={askAiOpen}
        onOpenChange={setAskAiOpen}
        onSuccess={onRefetch}
      />

      <RecurrenceDialog
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        onConfirm={(mode) => {
          setRecurrenceOpen(false);
          onDelete(event, mode);
        }}
        action="delete"
      />
    </>
  );
}
