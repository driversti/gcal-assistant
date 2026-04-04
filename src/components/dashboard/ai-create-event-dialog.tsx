"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { CalendarInfo } from "@/lib/types/calendar";

type DialogState = "idle" | "generating" | "review" | "creating";
type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface AiGeneratedEvent {
  summary: string;
  description: string;
  location: string | null;
  date: string;
  recurrence: Recurrence;
  sourceUrl: string;
  photoUrl: string | null;
}

interface AiModel {
  name: string;
  displayName: string;
}

interface AiCreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: CalendarInfo[];
  onSuccess: () => void;
}

function buildFullDescription(
  description: string,
  sourceUrl: string,
  photoUrl: string | null
): string {
  let full = description;
  if (sourceUrl) {
    full += `\n\nSource: ${sourceUrl}`;
  }
  if (photoUrl) {
    full += `\nPhoto: ${photoUrl}`;
  }
  return full;
}

export function AiCreateEventDialog({
  open,
  onOpenChange,
  calendars,
  onSuccess,
}: AiCreateEventDialogProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState<string>("");
  const [dialogState, setDialogState] = useState<DialogState>("idle");
  const [error, setError] = useState<string | null>(null);

  // AI model
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  // Generated event fields (editable after AI fills them)
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  // Writable calendars only
  const writableCalendars = calendars.filter(
    (c) => c.accessRole === "owner" || c.accessRole === "writer"
  );

  // Load AI models when dialog opens
  useEffect(() => {
    if (open && models.length === 0) {
      setIsModelsLoading(true);
      fetch("/api/ai/models", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          const fetchedModels = data.models || [];
          setModels(fetchedModels);

          if (fetchedModels.length > 0) {
            const savedModel = localStorage.getItem("gca:selectedAiModel");
            const isValid = fetchedModels.some(
              (m: AiModel) => m.name === savedModel
            );

            if (savedModel && isValid) {
              setSelectedModel(savedModel);
            } else {
              const preferred = fetchedModels.find(
                (m: AiModel) =>
                  m.name.includes("2.5-flash") || m.name.includes("2.0-flash")
              );
              setSelectedModel(
                preferred ? preferred.name : fetchedModels[0].name
              );
            }
          }
        })
        .catch(() => {
          setModels([
            { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
          ]);
          setSelectedModel("gemini-2.5-flash");
        })
        .finally(() => setIsModelsLoading(false));
    }
  }, [open, models.length]);

  function handleModelChange(val: string | null) {
    if (!val) return;
    setSelectedModel(val);
    localStorage.setItem("gca:selectedAiModel", val);
  }

  function resetForm() {
    setTitle("");
    setCalendarId("");
    setDialogState("idle");
    setError(null);
    setSummary("");
    setDescription("");
    setLocation("");
    setDate("");
    setRecurrence("NONE");
    setSourceUrl("");
    setPhotoUrl("");
    setFeedback("");
    setShowFeedback(false);
  }

  async function handleGenerate() {
    if (!title.trim() || !calendarId) return;

    setDialogState("generating");
    setError(null);

    const calendarName = writableCalendars.find(
      (c) => c.id === calendarId
    )?.summary;

    const currentFields =
      dialogState === "review"
        ? { summary, description, location, date, recurrence }
        : null;

    try {
      const res = await fetch("/api/events/ai-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          calendarId,
          calendarName,
          modelName: selectedModel,
          currentFields,
          feedback: feedback.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "AI generation failed");
      }

      const data = await res.json();
      const event: AiGeneratedEvent = data.event;

      setSummary(event.summary);
      setDescription(event.description);
      setLocation(event.location || "");
      setDate(event.date);
      setRecurrence(event.recurrence);
      setSourceUrl(event.sourceUrl);
      setPhotoUrl(event.photoUrl || "");
      setFeedback("");
      setShowFeedback(false);
      setDialogState("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDialogState(summary ? "review" : "idle");
    }
  }

  async function handleCreate() {
    if (!summary.trim() || !date || !calendarId) return;

    setDialogState("creating");
    setError(null);

    const fullDescription = buildFullDescription(
      description,
      sourceUrl,
      photoUrl
    );

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId,
          summary: summary.trim(),
          description: fullDescription,
          location: location.trim() || null,
          date,
          recurrence,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create event");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDialogState("review");
    }
  }

  const isGenerating = dialogState === "generating";
  const isCreating = dialogState === "creating";
  const isReview = dialogState === "review";
  const isBusy = isGenerating || isCreating;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Create Event with AI
          </DialogTitle>
          <DialogDescription>
            Type a subject and let AI research and fill in the event details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject</label>
            <Input
              placeholder='e.g. "Тарас Шевченко", "Battle of Thermopylae"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isBusy}
              autoFocus
            />
          </div>

          {/* Calendar selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Calendar</label>
            <Select
              value={calendarId}
              onValueChange={(val) => val && setCalendarId(val)}
              disabled={isBusy}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a calendar">
                  {(value: string) => {
                    const cal = writableCalendars.find((c) => c.id === value);
                    return cal ? cal.summary : "Select a calendar";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {writableCalendars.map((cal) => (
                  <SelectItem key={cal.id} value={cal.id}>
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    {cal.summary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {writableCalendars.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No writable calendars available.
              </p>
            )}
          </div>

          {/* AI Model selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">AI Model</label>
            <Select
              disabled={isModelsLoading || isBusy}
              value={selectedModel}
              onValueChange={handleModelChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isModelsLoading ? "Loading models..." : "Select a model"
                  }
                >
                  {(value: string) => {
                    const model = models.find((m) => m.name === value);
                    return model ? model.displayName : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.name} value={model.name}>
                    {model.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI-generated fields (shown after generation) */}
          {isReview && (
            <div className="space-y-3 rounded-lg border p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AI-Generated Fields
              </h4>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Summary (title)</label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Date</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={isBusy}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Recurrence</label>
                  <Select
                    value={recurrence}
                    onValueChange={(val) =>
                      val && setRecurrence(val as Recurrence)
                    }
                    disabled={isBusy}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Description</label>
                <textarea
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Location</label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isBusy}
                  placeholder="(optional)"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Source URL</label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Photo URL</label>
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  disabled={isBusy}
                  placeholder="(optional)"
                />
              </div>

              {/* Feedback section */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  disabled={isBusy}
                >
                  {showFeedback ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  Tell AI what to fix
                </button>
                {showFeedback && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      rows={2}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder='e.g. "Wrong date, should be March 9" or "Description should be in Ukrainian"'
                      disabled={isBusy}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isBusy || !feedback.trim()}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm font-medium text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>

          {!isReview ? (
            <Button
              onClick={handleGenerate}
              disabled={
                isBusy ||
                !title.trim() ||
                !calendarId ||
                !selectedModel
              }
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={isCreating || !summary.trim() || !date}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Event"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
