# Enrich with AI — Design Spec

## Summary

Replace the current "Ask AI" translate-only feature with a full "Enrich with AI" flow that researches existing events via Google Search, fills in missing fields (description, location, source URL), reformats the summary to match the established `YEAR — Name` pattern, and auto-detects the correct language based on subject matter.

## Language Rules

- Ukraine-related events → Ukrainian
- Poland-related events → Polish
- Russia-related events → Russian
- All other events → English

The AI determines the language from the subject matter. No user input needed.

## Backend

### `POST /api/events/[eventId]/ai` — Generate enrichment (rewrite)

**Request body:**
```json
{
  "calendarId": "string",
  "modelName": "string (optional, defaults to gemini-2.5-flash)",
  "feedback": "string (optional, for regeneration loop)"
}
```

**Behavior:**
1. Fetch the event from Google Calendar API (to get current summary, calendar name)
2. Send `summary` + `calendarName` to Gemini with **Google Search grounding** enabled
3. Return enriched fields as JSON — do NOT update the event (frontend review step handles that)

**System prompt** — adapted from the AI-create route's prompt:
- Same summary format rules (`YEAR — Name (d./b. YYYY)` for people, `YEAR — Event Name` for events)
- Same birth/death abbreviation conventions per language
- Description: 1-3 sentence factual summary, no URLs
- Location: birthplace for birthday calendars, place of death for death calendars, event site for historical events
- sourceUrl: most relevant Wikipedia article (prefer the Wikipedia in the detected language)
- photoUrl: direct URL to a portrait or relevant image (Wikimedia Commons preferred)
- Language auto-detection based on subject matter (see Language Rules above)
- Feedback loop support: if `feedback` is provided, the prompt includes current fields + user corrections

**Response:**
```json
{
  "success": true,
  "enrichment": {
    "summary": "1814 — Тарас Шевченко (п. 1861)",
    "description": "Український поет, письменник, художник...",
    "location": "Моринці, Київська губернія",
    "sourceUrl": "https://uk.wikipedia.org/wiki/...",
    "photoUrl": "https://upload.wikimedia.org/..."
  }
}
```

**What changes from the current route:**
- `targetLanguage` parameter removed
- `feedback` parameter added
- Google Search grounding enabled
- System prompt changed from translation to research+enrichment
- No longer updates the event — returns preview only
- Response shape changes from `{ result: { summary, location, description } }` to `{ enrichment: { summary, description, location, sourceUrl, photoUrl } }`

### Saving enriched data

Uses the existing `PATCH /api/events/[eventId]` route. The frontend builds the full description client-side (appending `\n\nSource: <url>` and `\nPhoto: <url>`) before sending.

For recurring events: sends `recurrenceMode: "all"` + `recurringEventId`.

### Fix `updateEvent()` — `"all"` mode uses full PUT

**File:** `src/lib/google/update-event.ts`

Change the `"all"` recurrence mode from `events.patch` to `events.update` (full PUT) on the master event. This ensures all instances (including materialized ones) get updated, not just the template.

Steps for `"all"` mode:
1. Fetch the full master event via `events.get`
2. Merge the update fields into the master event object
3. Full PUT via `events.update` on the master
4. If `eventId !== recurringEventId`, also patch the specific instance (materialized instances don't auto-inherit)

## Frontend

### `AskAiDialog` component (rewrite)

**File:** `src/components/dashboard/ask-ai-dialog.tsx`

Two-step dialog flow:

#### Step 1: Trigger
- Title: "Enrich with AI" with `Sparkles` icon
- Description: "Research this event and fill in missing details"
- Controls: AI Model selector + "Enrich with AI" button
- No language input

#### Step 2: Review (after AI responds)
Editable form showing all enriched fields:
- **Summary** — text input
- **Description** — textarea (3 rows)
- **Location** — text input
- **Source URL** — text input
- **Photo URL** — text input

Plus:
- "Tell AI what to fix" — collapsible section with textarea + "Regenerate" button
- Footer: Cancel + "Save Changes"

**Save action:**
1. Build full description via `buildFullDescription(description, sourceUrl, photoUrl)`
2. `PATCH /api/events/[eventId]` with `{ calendarId, fields: { summary, description, location }, recurrenceMode, recurringEventId }`
3. For recurring events: `recurrenceMode: "all"`, include `recurringEventId`
4. On success: call `onSuccess()`, close dialog

**`buildFullDescription` function** — extracted/shared from `ai-create-event-dialog.tsx` or duplicated inline (it's 6 lines).

### Menu item rename

**File:** `src/components/dashboard/event-actions-menu.tsx`

"Ask AI" → "Enrich with AI" in the dropdown menu.

## What's NOT changing

- `AiCreateEventDialog` — untouched, keeps its own flow
- `AI FAB` button — untouched
- Event data model (`CalendarEvent` interface) — no new fields
- `PATCH /api/events/[eventId]` route — no changes to the route itself (only `updateEvent()` behavior)
- Source URL rendering in `EventCard` — already implemented
