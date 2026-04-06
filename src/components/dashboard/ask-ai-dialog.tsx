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
import { Loader2, ChevronDown, ChevronUp, Sparkles, RefreshCw, ImageOff } from "lucide-react";
import type { CalendarEvent } from "@/lib/types/event";

type DialogState = "idle" | "enriching" | "review" | "saving";
type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface Enrichment {
  summary: string;
  description: string;
  location: string;
  date: string;
  recurrence: Recurrence;
  sourceUrl: string;
  photoUrl: string;
}

interface AiModel {
  name: string;
  displayName: string;
}

interface AskAiDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AskAiDialog({
  event,
  open,
  onOpenChange,
  onSuccess,
}: AskAiDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("idle");
  const [error, setError] = useState<string | null>(null);

  // AI model
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  // Enriched fields (editable after AI fills them)
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("YEARLY");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [rejectedPhotoUrls, setRejectedPhotoUrls] = useState<string[]>([]);

  // Feedback
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

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
    setDialogState("idle");
    setError(null);
    setSummary("");
    setDescription("");
    setLocation("");
    setDate("");
    setRecurrence("YEARLY");
    setSourceUrl("");
    setPhotoUrl("");
    setPhotoError(false);
    setPhotoLoading(false);
    setRejectedPhotoUrls([]);
    setFeedback("");
    setShowFeedback(false);
  }

  async function handleFindNewPhoto() {
    if (!summary && !event?.summary) return;
    setPhotoLoading(true);
    setPhotoError(false);

    const rejected = photoUrl
      ? [...rejectedPhotoUrls, photoUrl]
      : rejectedPhotoUrls;
    setRejectedPhotoUrls(rejected);

    try {
      const res = await fetch("/api/ai/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: summary || event?.summary || "",
          rejectedUrls: rejected,
          modelName: selectedModel || "gemini-2.5-flash",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to find photo");
      }

      const data = await res.json();
      if (data.photoUrl) {
        setPhotoUrl(data.photoUrl);
        setPhotoError(false);
      }
    } catch {
      setPhotoError(true);
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleEnrich() {
    if (!event || !selectedModel) return;

    setDialogState("enriching");
    setError(null);

    try {
      const res = await fetch(`/api/events/${event.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: event.calendarId,
          modelName: selectedModel,
          feedback: feedback.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "AI enrichment failed");
      }

      const data = await res.json();
      const enrichment: Enrichment = data.enrichment;

      setSummary(enrichment.summary);
      setDescription(enrichment.description);
      setLocation(enrichment.location || "");
      setDate(enrichment.date ?? "");
      setRecurrence(!enrichment.recurrence || enrichment.recurrence === "NONE" ? "YEARLY" : enrichment.recurrence);
      setSourceUrl(enrichment.sourceUrl);
      setPhotoUrl(enrichment.photoUrl || "");
      setPhotoError(false);
      setRejectedPhotoUrls([]);
      setFeedback("");
      setShowFeedback(false);
      setDialogState("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDialogState(summary ? "review" : "idle");
    }
  }

  async function handleSave() {
    if (!event || !summary.trim()) return;

    setDialogState("saving");
    setError(null);

    const fullDescription = buildFullDescription(
      description,
      sourceUrl,
      photoUrl
    );

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: event.calendarId,
          fields: {
            summary: summary.trim(),
            description: fullDescription,
            location: location.trim() || null,
          },
          recurrenceMode: event.recurringEventId ? "all" : "single",
          recurringEventId: event.recurringEventId ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save changes");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDialogState("review");
    }
  }

  const isEnriching = dialogState === "enriching";
  const isSaving = dialogState === "saving";
  const isReview = dialogState === "review";
  const isBusy = isEnriching || isSaving;

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
            Enrich with AI
          </DialogTitle>
          <DialogDescription>
            Research this event and fill in missing details using AI with web
            search.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          {/* Enriched fields (shown after generation) */}
          {isReview && (
            <div className="space-y-3 rounded-lg border p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AI-Enriched Fields
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
                <label className="text-xs font-medium">Photo</label>
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                    {photoUrl && !photoError ? (
                      <img
                        src={photoUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={() => setPhotoError(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                    {photoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Input
                      value={photoUrl}
                      onChange={(e) => {
                        setPhotoUrl(e.target.value);
                        setPhotoError(false);
                      }}
                      disabled={isBusy}
                      placeholder="(optional)"
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFindNewPhoto}
                      disabled={isBusy || photoLoading}
                      className="w-fit"
                    >
                      {photoLoading ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      Find new photo
                    </Button>
                  </div>
                </div>
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
                      placeholder='e.g. "Description should be in Ukrainian" or "Wrong person, I mean the poet"'
                      disabled={isBusy}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEnrich}
                      disabled={isBusy || !feedback.trim()}
                    >
                      {isEnriching ? (
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
              onClick={handleEnrich}
              disabled={isBusy || !selectedModel}
            >
              {isEnriching ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Enriching...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  Enrich with AI
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving || !summary.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
