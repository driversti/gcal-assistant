"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, X } from "lucide-react";
import { RecurrenceDialog } from "./cells/recurrence-dialog";
import type { CalendarEvent } from "@/lib/types/event";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { EventUpdateFields, RecurrenceMode } from "@/lib/types/event-update";
import { format, parseISO, addDays, subDays } from "date-fns";

function extractMeta(desc: string | null): {
  photoUrl: string | null;
  sourceUrl: string | null;
  cleanDescription: string;
} {
  if (!desc) return { photoUrl: null, sourceUrl: null, cleanDescription: "" };
  let photoUrl: string | null = null;
  let sourceUrl: string | null = null;
  const lines = desc.split("\n").filter((line) => {
    const photoMatch = line.match(/^Photo:\s*(https?:\/\/\S+)/);
    if (photoMatch) { photoUrl = photoMatch[1]; return false; }
    const sourceMatch = line.match(/^Source:\s*(https?:\/\/\S+)/);
    if (sourceMatch) { sourceUrl = sourceMatch[1]; return false; }
    return true;
  });
  return { photoUrl, sourceUrl, cleanDescription: lines.join("\n").trim() };
}

interface EditPanelProps {
  event: CalendarEvent | null;
  calendars: CalendarInfo[];
  open: boolean;
  onClose: () => void;
  onUpdateEvent: (
    eventId: string,
    calendarId: string,
    fields: EventUpdateFields,
    recurrenceMode?: RecurrenceMode,
    recurringEventId?: string
  ) => Promise<void>;
  onDelete: (event: CalendarEvent, recurrenceMode?: RecurrenceMode) => Promise<void>;
}

export function EditPanel({
  event,
  calendars,
  open,
  onClose,
  onUpdateEvent,
  onDelete,
}: EditPanelProps) {
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);
  const [pendingFields, setPendingFields] = useState<EventUpdateFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const handleStartY = useRef(0);

  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStartY.current = e.touches[0].clientY;
  }, []);

  const onHandleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - handleStartY.current;
    if (dy < -30) setExpanded(true);
    if (dy > 30) setExpanded(false);
  }, []);

  useEffect(() => {
    if (event && open) {
      setError(null);
      setExpanded(false);
      setSummary(event.summary);
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      if (event.isAllDay) {
        setStartDate(event.start.split("T")[0]);
        // Google Calendar uses exclusive end dates for all-day events.
        // "April 5" means the event ends before April 5 (i.e., it's on April 4).
        // Show the inclusive last day to the user.
        const exclusiveEnd = event.end.split("T")[0];
        setEndDate(format(subDays(parseISO(exclusiveEnd), 1), "yyyy-MM-dd"));
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

  if (!event || !open) return null;

  const calendarInfo = calendars.find((c) => c.id === event.calendarId);
  const isRecurring = !!event.recurringEventId;
  const { photoUrl, sourceUrl } = extractMeta(event.description);

  function buildFields(): EventUpdateFields {
    const fields: EventUpdateFields = {};
    if (summary !== event!.summary) fields.summary = summary;
    if (location !== (event!.location ?? ""))
      fields.location = location || null;
    if (description !== (event!.description ?? ""))
      fields.description = description || null;


    if (event!.isAllDay) {
      if (startDate !== event!.start.split("T")[0])
        fields.start = { date: startDate };
      // Convert user's inclusive end date back to Google's exclusive format
      const origEndInclusive = format(subDays(parseISO(event!.end.split("T")[0]), 1), "yyyy-MM-dd");
      if (endDate !== origEndInclusive)
        fields.end = { date: format(addDays(parseISO(endDate), 1), "yyyy-MM-dd") };
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
      onClose();
      return;
    }

    if (isRecurring && !recurrenceMode) {
      setPendingFields(fields);
      setPendingAction("save");
      setRecurrenceOpen(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onUpdateEvent(
        event!.id,
        event!.calendarId,
        fields,
        recurrenceMode,
        event!.recurringEventId
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save event");
    } finally {
      setSaving(false);
      setPendingFields(null);
      setPendingAction(null);
    }
  }

  async function handleDelete(recurrenceMode?: RecurrenceMode) {
    if (isRecurring && !recurrenceMode) {
      setPendingAction("delete");
      setRecurrenceOpen(true);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(event!, recurrenceMode);
      onClose();
    } finally {
      setDeleting(false);
      setPendingAction(null);
    }
  }

  function handleRecurrenceConfirm(mode: RecurrenceMode) {
    setRecurrenceOpen(false);
    if (pendingAction === "save") {
      handleSave(mode);
    } else if (pendingAction === "delete") {
      handleDelete(mode);
    }
  }

  const formContent = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
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
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {sourceUrl.includes("wikipedia.org") ? "Wikipedia" : "Source"}
            </a>
          )}
        </div>
        {photoUrl && (
          <img
            src={photoUrl}
            alt={summary}
            className="h-20 w-20 rounded-lg border object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Title</label>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

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

      <div className="space-y-1">
        <label className="text-sm font-medium">Location</label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
        />
      </div>

      <div className={`space-y-1 ${expanded ? "flex flex-1 flex-col" : ""}`}>
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add description"
          rows={expanded ? undefined : 4}
          className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm ${expanded ? "flex-1 resize-none" : ""}`}
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button onClick={() => handleSave()} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => handleDelete()}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop for narrow screens */}
      <div
        className="fixed inset-0 z-40 bg-black/40 sm:hidden"
        onClick={onClose}
      />

      {/* Panel container */}
      <div className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t bg-background shadow-2xl transition-[max-height] duration-300 sm:static sm:inset-auto sm:z-auto sm:max-h-none sm:w-[400px] sm:shrink-0 sm:rounded-none sm:rounded-l-lg sm:border-l sm:border-t-0 sm:shadow-none ${expanded ? "max-h-[100vh]" : "max-h-[70vh]"}`}>
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          onTouchStart={onHandleTouchStart}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-muted-foreground/30 sm:hidden" />
          <h2 className="text-base font-bold">Edit Event</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {formContent}
      </div>

      <RecurrenceDialog
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
        onConfirm={handleRecurrenceConfirm}
      />
    </>
  );
}
