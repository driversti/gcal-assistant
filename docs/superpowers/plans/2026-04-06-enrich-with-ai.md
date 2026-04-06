# Enrich with AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the translate-only "Ask AI" feature with a full "Enrich with AI" flow that researches events via Google Search, fills missing fields, reformats summaries, and auto-detects the correct language.

**Architecture:** Three changes — (1) fix `updateEvent()` `"all"` mode to use full PUT so recurring event updates propagate to all instances, (2) rewrite the `POST /api/events/[eventId]/ai` backend route from translate-only to research+enrich using Google Search grounding, (3) rewrite the `AskAiDialog` frontend component with a two-step generate→review flow.

**Tech Stack:** Next.js, React, Google Calendar API (googleapis), Gemini AI (@google/genai with Google Search grounding), Tailwind CSS, Shadcn UI

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/google/update-event.ts:59-66` | Fix `"all"` recurrence mode to use full PUT |
| Rewrite | `src/app/api/events/[eventId]/ai/route.ts` | Enrichment API with Google Search grounding |
| Rewrite | `src/components/dashboard/ask-ai-dialog.tsx` | Two-step enrich dialog (generate → review → save) |
| Modify | `src/components/dashboard/event-actions-menu.tsx:63-66` | Rename menu item "Ask AI" → "Enrich with AI" |

---

### Task 1: Fix `updateEvent()` "all" mode to use full PUT

**Files:**
- Modify: `src/lib/google/update-event.ts:59-66`

- [ ] **Step 1: Replace the `"all"` branch with full PUT logic**

In `src/lib/google/update-event.ts`, replace the `"all"` branch (lines 59-66):

```typescript
// Current code to replace:
  if (recurrenceMode === "all") {
    await calendarApi.events.patch({
      calendarId,
      eventId: recurringEventId,
      requestBody: body,
    });
    return;
  }
```

With:

```typescript
  if (recurrenceMode === "all") {
    // Full PUT on the master event so ALL instances (including already-materialised
    // ones) inherit the changes. A simple patch on the master only updates the
    // template for future instances.
    const { data: masterEvent } = await calendarApi.events.get({
      calendarId,
      eventId: recurringEventId,
    });

    await calendarApi.events.update({
      calendarId,
      eventId: recurringEventId,
      requestBody: { ...masterEvent, ...body },
    });

    // Materialized instances keep their own identity — patch the specific
    // instance so the user sees the change immediately.
    if (eventId !== recurringEventId) {
      await calendarApi.events.patch({
        calendarId,
        eventId,
        requestBody: body,
      });
    }
    return;
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google/update-event.ts
git commit -m "fix: use full PUT for 'all' recurrence mode so changes propagate to materialised instances"
```

---

### Task 2: Rewrite the AI enrichment backend route

**Files:**
- Rewrite: `src/app/api/events/[eventId]/ai/route.ts`

- [ ] **Step 1: Replace the route with the enrichment implementation**

Replace the entire contents of `src/app/api/events/[eventId]/ai/route.ts` with:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are a calendar event research assistant. Given an existing calendar event and its calendar type, research the subject and return enriched event data.

Rules:
- Summary format: ALWAYS "YEAR — Name (d./b. YYYY)" for people, "YEAR — Event Name" for events.
- For people on birthday calendars: include death year, e.g. "1814 — Тарас Шевченко (п. 1861)".
- For people on death calendars: include birth year, e.g. "1861 — Тарас Шевченко (н. 1814)".
- For non-person events: just year and name, e.g. "1986 — Chernobyl disaster".
- Use "d." / "b." for English, "п." / "н." for Ukrainian, "ум." / "р." for Russian, etc. — use the abbreviation natural for the output language.
- Language rules (STRICT):
  - Ukraine-related subjects → Ukrainian
  - Poland-related subjects → Polish
  - Russia-related subjects → Russian
  - All other subjects → English
- Description: brief factual description (role, significance, key facts) — 1-3 sentences. Do NOT include URLs.
- Location: most relevant location (birthplace for birthday calendars, place of death for death calendars, event site for historical events). Can be null if not applicable.
- sourceUrl: most relevant Wikipedia article URL (prefer the Wikipedia in the output language). If no Wikipedia article exists, use another authoritative source.
- photoUrl: direct URL to a portrait or relevant image (Wikimedia Commons preferred). Return null if not found. Must point to an actual image file.
- Output ONLY valid JSON matching the required schema. No explanations.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await request.json();

  const { calendarId, modelName = "gemini-2.5-flash", feedback } = body;
  if (!calendarId) {
    return NextResponse.json(
      { error: "Missing calendarId" },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch the event
    const calendarApi = google.calendar({ version: "v3", auth: client });
    const { data: event } = await calendarApi.events.get({
      calendarId,
      eventId,
    });

    // 2. Resolve calendar name
    const { data: calendarMeta } = await calendarApi.calendars.get({
      calendarId,
    });
    const calendarName = calendarMeta.summary ?? "Unknown";

    // 3. Build the user prompt
    let prompt = `Existing event summary: "${event.summary ?? "(no title)"}"\n`;
    prompt += `Calendar type: "${calendarName}"\n`;

    if (event.description) {
      prompt += `Current description: "${event.description}"\n`;
    }
    if (event.location) {
      prompt += `Current location: "${event.location}"\n`;
    }

    if (feedback) {
      prompt += `\nThe user has reviewed the previous AI enrichment and wants corrections.\n`;
      prompt += `User feedback: "${feedback}"\n`;
      prompt += `\nPlease regenerate ALL fields taking the user's feedback into account.\n`;
    }

    prompt += `\nResearch this subject and return enriched event data as JSON.`;

    console.log(`\n[AI Enrich] ── Request ─────────────────────────────────`);
    console.log(`[AI Enrich] Model:    ${modelName}`);
    console.log(`[AI Enrich] Event:    ${event.summary ?? "(no title)"} (${eventId})`);
    console.log(`[AI Enrich] Calendar: ${calendarName}`);
    console.log(`[AI Enrich] Feedback: ${feedback ?? "(none)"}`);

    // 4. Call Gemini with Google Search grounding
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        tools: [{ googleSearch: {} }],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Event title formatted as 'YEAR — Name (dates)' or 'YEAR — Event Name'",
            },
            description: {
              type: Type.STRING,
              description: "Brief factual description (1-3 sentences). No URLs.",
            },
            location: {
              type: Type.STRING,
              description: "Most relevant location. Empty string if not applicable.",
              nullable: true,
            },
            sourceUrl: {
              type: Type.STRING,
              description: "Wikipedia article URL or other authoritative source URL",
            },
            photoUrl: {
              type: Type.STRING,
              description: "Direct URL to a portrait or relevant image. Empty string if not found.",
              nullable: true,
            },
          },
          required: ["summary", "description", "sourceUrl"],
        },
      },
    });

    const resultText = response.text;
    const finishReason = response.candidates?.[0]?.finishReason;

    console.log(`[AI Enrich] ── Response ────────────────────────────────`);
    console.log(`[AI Enrich] Finish reason: ${finishReason}`);
    console.log(`[AI Enrich] Raw response: ${resultText}`);

    if (!resultText) {
      throw new Error(
        `Gemini returned no content. Finish reason: ${finishReason ?? "unknown"}`
      );
    }

    let result: {
      summary: string;
      description: string;
      location?: string | null;
      sourceUrl: string;
      photoUrl?: string | null;
    };

    try {
      result = JSON.parse(resultText);
    } catch {
      console.error("[AI Enrich] Failed to parse Gemini JSON:", resultText?.slice(0, 500));
      throw new Error("Gemini returned invalid JSON");
    }

    console.log(`[AI Enrich] ── Done ────────────────────────────────────\n`);

    return NextResponse.json({
      success: true,
      enrichment: {
        summary: result.summary,
        description: result.description,
        location: result.location || null,
        sourceUrl: result.sourceUrl,
        photoUrl: result.photoUrl || null,
      },
    });
  } catch (err: unknown) {
    console.error("[AI Enrich] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to enrich event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/[eventId]/ai/route.ts
git commit -m "feat: rewrite AI route from translate-only to research+enrich with Google Search grounding"
```

---

### Task 3: Rewrite the AskAiDialog component

**Files:**
- Rewrite: `src/components/dashboard/ask-ai-dialog.tsx`

- [ ] **Step 1: Replace the dialog with the two-step enrichment flow**

Replace the entire contents of `src/components/dashboard/ask-ai-dialog.tsx` with:

```tsx
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
import type { CalendarEvent } from "@/lib/types/event";

type DialogState = "idle" | "enriching" | "review" | "saving";

interface Enrichment {
  summary: string;
  description: string;
  location: string;
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
  const [sourceUrl, setSourceUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

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
    setSourceUrl("");
    setPhotoUrl("");
    setFeedback("");
    setShowFeedback(false);
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
      setSourceUrl(enrichment.sourceUrl);
      setPhotoUrl(enrichment.photoUrl || "");
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ask-ai-dialog.tsx
git commit -m "feat: rewrite AskAiDialog as two-step enrich flow with review and feedback"
```

---

### Task 4: Rename menu item

**Files:**
- Modify: `src/components/dashboard/event-actions-menu.tsx:63-66`

- [ ] **Step 1: Update the menu item label**

In `src/components/dashboard/event-actions-menu.tsx`, change line 65-66 from:

```tsx
          <DropdownMenuItem onClick={() => setAskAiOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI
          </DropdownMenuItem>
```

To:

```tsx
          <DropdownMenuItem onClick={() => setAskAiOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Enrich with AI
          </DropdownMenuItem>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/event-actions-menu.tsx
git commit -m "feat: rename 'Ask AI' menu item to 'Enrich with AI'"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test enrichment on a non-recurring event**

1. Navigate to a day with an event that has only a summary (no description/location)
2. Click the three-dots menu → "Enrich with AI"
3. Select a model and click "Enrich with AI"
4. Verify the review step shows enriched fields (summary in `YEAR — Name` format, description, location, source URL)
5. Edit a field to verify inputs are editable
6. Click "Save Changes"
7. Verify the event updates in the timeline with the new fields
8. Verify the source link icon appears on the event card

- [ ] **Step 3: Test enrichment on a recurring event**

1. Find a recurring event
2. Enrich it via the same flow
3. Verify changes propagate to other instances of the series

- [ ] **Step 4: Test the feedback/regeneration loop**

1. Enrich an event
2. In the review step, expand "Tell AI what to fix"
3. Type feedback (e.g., "Description should be shorter") and click "Regenerate"
4. Verify the fields update based on the feedback

- [ ] **Step 5: Test error handling**

1. Try enriching with no internet / invalid API key — verify error message appears
2. Verify Cancel button works at every stage
