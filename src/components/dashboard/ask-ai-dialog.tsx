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
import type { CalendarEvent } from "@/lib/types/event";

interface AskAiDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface AiModel {
  name: string;
  displayName: string;
}

export function AskAiDialog({ event, open, onOpenChange, onSuccess }: AskAiDialogProps) {
  const [language, setLanguage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isModelsLoading, setIsModelsLoading] = useState(false);

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
            const isValidModel = fetchedModels.some((m: AiModel) => m.name === savedModel);
            
            if (savedModel && isValidModel) {
              setSelectedModel(savedModel);
            } else {
              // Try to find gemini-3.1-flash-lite-preview or flash-lite first
              const flashLite = fetchedModels.find((m: AiModel) => m.name.includes("3.1-flash-lite-preview") || m.name.includes("flash-lite"));
              if (flashLite) {
                setSelectedModel(flashLite.name);
              } else {
                setSelectedModel(fetchedModels[0].name);
              }
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load models:", err);
          // Fallback static model if fetch fails
          setModels([{ name: "gemini-3.1-flash-lite-preview", displayName: "Gemini 3.1 Flash Lite" }]);
          setSelectedModel("gemini-3.1-flash-lite-preview");
        })
        .finally(() => {
          setIsModelsLoading(false);
        });
    }
  }, [open, models.length]);

  function handleModelChange(val: string | null) {
    if (!val) return;
    setSelectedModel(val);
    localStorage.setItem("gca:selectedAiModel", val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !language.trim() || !selectedModel) return;

    try {
      setIsSubmitting(true);
      setError(null);
      
      const res = await fetch(`/api/events/${event.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: event.calendarId,
          targetLanguage: language.trim(),
          modelName: selectedModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to process AI request");
      }

      onSuccess();
      onOpenChange(false);
      setLanguage("");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) {
        setLanguage("");
        setError(null);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Translate / Rewrite Event</DialogTitle>
          <DialogDescription>
            Use Gemini AI to translate this event&apos;s title, location, and description into another language.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">AI Model</label>
            <Select
              disabled={isModelsLoading || isSubmitting}
              value={selectedModel}
              onValueChange={handleModelChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isModelsLoading ? "Loading models..." : "Select a model"} />
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

          <div className="space-y-2">
            <label htmlFor="language" className="text-sm font-medium leading-none">
              Target Language
            </label>
            <Input
              id="language"
              placeholder="e.g. Ukrainian, English, Formal Polish..."
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !language.trim() || !selectedModel}>
              {isSubmitting ? "Generating..." : "Ask AI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
