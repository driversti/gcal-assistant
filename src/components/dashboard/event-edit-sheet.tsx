"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
import { RecurrenceDialog } from "./cells/recurrence-dialog";
import { format, parseISO } from "date-fns";

interface EventEditSheetProps {
  event: CalendarEvent | null;
  calendars: CalendarInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateEvent: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  onDelete: (event: CalendarEvent) => Promise<void>;
}

export function EventEditSheet({
  event,
  calendars,
  open,
  onOpenChange,
  onUpdateEvent,
  onDelete,
}: EventEditSheetProps) {
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [pendingFields, setPendingFields] = useState<EventUpdateFields | null>(null);

  useEffect(() => {
    if (event && open) {
      setSummary(event.summary);
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setStatus(event.status);
      if (event.isAllDay) {
        setStartDate(event.start.split("T")[0]);
        setEndDate(event.end.split("T")[0]);
        setStartTime("");
        setEndTime("");
      } else {
        const s = parseISO(event.start);
        const e = parseISO(event.end);
        setStartDate(format(s, "yyyy-MM-dd"));
        setStartTime(format(s, "HH:mm"));
        setEndDate(format(e, "yyyy-MM-dd"));
        setEndTime(format(e, "HH:mm"));
      }
    }
  }, [event, open]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!event || !open) return null;

  const calendarInfo = calendars.find((c) => c.id === event.calendarId);
  const isRecurring = !!event.recurringEventId;

  function buildFields(): EventUpdateFields {
    const fields: EventUpdateFields = {};
    if (summary !== event!.summary) fields.summary = summary;
    if (location !== (event!.location ?? ""))
      fields.location = location || null;
    if (description !== (event!.description ?? ""))
      fields.description = description || null;
    if (status !== event!.status) fields.status = status;

    if (event!.isAllDay) {
      if (startDate !== event!.start.split("T")[0])
        fields.start = { date: startDate };
      if (endDate !== event!.end.split("T")[0])
        fields.end = { date: endDate };
    } else {
      const origStart = format(parseISO(event!.start), "yyyy-MM-dd'T'HH:mm");
      const newStart = `${startDate}T${startTime}`;
      if (newStart !== origStart)
        fields.start = { dateTime: `${newStart}:00` };

      const origEnd = format(parseISO(event!.end), "yyyy-MM-dd'T'HH:mm");
      const newEnd = `${endDate}T${endTime}`;
      if (newEnd !== origEnd) fields.end = { dateTime: `${newEnd}:00` };
    }

    return fields;
  }

  async function handleSave(recurrenceMode?: RecurrenceMode) {
    const fields = pendingFields ?? buildFields();
    if (Object.keys(fields).length === 0) {
      onOpenChange(false);
      return;
    }

    if (isRecurring && !recurrenceMode) {
      setPendingFields(fields);
      setRecurrenceOpen(true);
      return;
    }

    setSaving(true);
    try {
      await onUpdateEvent(
        event!.id,
        event!.calendarId,
        fields,
        recurrenceMode,
        event!.recurringEventId
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
      setPendingFields(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(event!);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background lg:hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold">Edit Event</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 overflow-auto p-4 pb-32">
          {/* Calendar badge */}
          {calendarInfo && (
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: calendarInfo.backgroundColor }}
              />
              <span className="text-sm text-muted-foreground">
                {calendarInfo.summary}
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {!event.isAllDay && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Start time</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">End date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!event.isAllDay && (
              <div className="space-y-1">
                <label className="text-sm font-medium">End time</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={4}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            >
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t bg-background p-4 lg:hidden">
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Event"}
          </Button>
        </div>
      </div>

      <RecurrenceDialog
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        onConfirm={(mode) => {
          setRecurrenceOpen(false);
          handleSave(mode);
        }}
      />
    </>
  );
}
