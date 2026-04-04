# AI-Powered Event Creation — Feature Specification

## Overview
Add the ability to create Google Calendar events with AI assistance. The user types a subject (e.g., "Taras Shevchenko"), selects a target calendar, and Gemini fills in all event details by searching the web. The user reviews, optionally corrects, and creates the event.

## User Flow

### 1. Entry Point
- **Floating Action Button (FAB)** in the bottom-right corner of the dashboard
- Icon: `Sparkles` (or `Plus` with sparkle accent) from lucide-react
- Always visible, overlays the events table
- Click opens the "Create Event with AI" dialog

### 2. Initial Form (before AI generation)
The dialog opens with these fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Text input | Yes | Free-text subject in any language (e.g., "Тарас Шевченко", "Battle of Thermopylae") |
| Calendar | Dropdown | Yes | Shows only writable calendars (accessRole: owner/writer) |
| AI Model | Dropdown | No | Pre-selected from localStorage (`gca:selectedAiModel`). Loaded from `/api/ai/models`. Only grounding-capable models. |

**Action button:** "Generate with AI" (disabled until title + calendar are filled)

### 3. AI Generation
On "Generate with AI":
- Show loading state on the button / spinner overlay on the form
- Call `POST /api/events/ai-create` with `{ title, calendarId, modelName }`
- Backend uses **Gemini with Google Search grounding** to research the subject
- AI returns structured JSON with all event fields

**AI fills these fields:**

| Field | Behavior |
|-------|----------|
| **Summary** | Formatted as `YEAR — Name (dates)` for people or `YEAR — Event` for events. This IS the Google Calendar event title. Short and clean. |
| **Date** | AI determines the correct date (birthday, event date, etc.). Always all-day. |
| **Description** | Contains: (1) factual description (role, significance, 1-3 sentences), (2) source URL (Wikipedia preferred), (3) photo URL if available. See format below. |
| **Location** | Best-effort: birthplace for people, site for battles, country for holidays. Can be empty. |
| **Recurrence** | AI suggests if applicable (yearly for birthdays/death anniversaries/holidays). Pre-selected in dropdown. |
| **Notification** | Always set: popup reminder on event day at 9:00 AM local time. Not editable by user — applied automatically. |

### 4. Review & Edit
After AI returns, the form shows all filled fields as **editable inputs**:
- Summary: text input (pre-filled with `YEAR — Name (dates)` format)
- Date: date picker (pre-filled)
- Description: textarea (pre-filled with factual description + Source/Photo URLs)
- Location: text input (pre-filled, can be empty)
- Recurrence: dropdown with options: None / Daily / Weekly / Monthly / Yearly (AI pre-selects)
- **Feedback field**: collapsible textarea labeled "Tell AI what to fix" with a "Regenerate" button

**Two correction paths:**
1. **Edit & accept**: User directly edits any field, then clicks "Create"
2. **AI feedback loop**: User types feedback (e.g., "wrong date, should be March 9"), clicks "Regenerate" → AI receives current field values + feedback, regenerates ALL fields

### 5. Create Event
- "Create" button inserts the event into Google Calendar via `events.insert()`
- On success: close dialog, show success toast, refresh events table (if current date view matches event date)
- On failure: show error toast, keep dialog open

### 6. Error Handling
- **AI generation fails**: Show error message in the dialog. User can retry or fill fields manually.
- **Grounding unavailable**: Show error, let user retry. No silent fallback.
- **Event creation fails**: Show error toast with details. Dialog stays open.
- **No writable calendars**: Disable FAB or show message explaining no writable calendars are available.

## Summary Format (event title)
Short and clean: `YEAR — Name (death/birth year)`

**Birthday calendar:**
- `1814 — Тарас Шевченко (п. 1861)`
- `1844 — Carl Benz (d. 1929)`

**Death calendar:**
- `1861 — Тарас Шевченко (н. 1814)`
- `1929 — Carl Benz (b. 1844)`

**Worldwide/historical:**
- `480 BC — Battle of Thermopylae`
- `1986 — Chernobyl disaster`

## Description Format (event body)
The description carries the factual content. Structure:

```
Ukrainian poet, writer, artist, and national hero. Author of "Kobzar", founder of modern Ukrainian literature. Was a serf who was ransomed by friends.

Source: https://uk.wikipedia.org/wiki/Шевченко_Тарас_Григорович
Photo: https://upload.wikimedia.org/wikipedia/commons/.../Taras_Shevchenko.jpg
```

**Rules:**
- First part: brief factual description (role, significance, key facts) — 1-3 sentences
- Source URL: Wikipedia preferred (in detected language), other authoritative sources if no Wikipedia article exists
- Photo URL: link to a portrait/relevant image (Wikimedia Commons preferred). Include when available, omit if not found.
- Each URL on its own line, labeled with prefix (`Source:`, `Photo:`)

## Language Behavior
- AI detects the language of the typed title
- All generated fields (title rewrite, description, location) are written in that same language
- No explicit language selector needed

## AI Prompt Design

### System instruction
```
You are a calendar event research assistant. Given a subject and calendar type,
research the subject using web search and return structured event data.

Rules:
- Summary format: ALWAYS "YEAR — Name (d./b. YYYY)" for people, "YEAR — Event Name" for events
- For people on birthday calendars: include death year, e.g. "1814 — Тарас Шевченко (п. 1861)"
- For people on death calendars: include birth year, e.g. "1861 — Тарас Шевченко (н. 1814)"
- For non-person events: just year and name, e.g. "1986 — Chernobyl disaster"
- Description: brief factual description (role, significance, 1-3 sentences), then Source URL, then Photo URL
- Detect the language of the input title and write ALL fields in that language
- You MAY rewrite the title/summary to be more appropriate for the calendar context
- Location: provide the most relevant location (birthplace, event site, etc.)
- Date: determine the correct historical date for this subject
- Source URL: prefer Wikipedia in the detected language; fall back to English Wikipedia or other authoritative sources
- Photo URL: link to a portrait or relevant image (Wikimedia Commons preferred), omit if not found
- Recurrence: suggest "YEARLY" for birthdays, death anniversaries, and annual holidays. "NONE" otherwise.
- Output ONLY valid JSON matching the required schema
```

### Request includes (for feedback loop)
```json
{
  "title": "user's original or current title",
  "calendarName": "Birthday",
  "currentFields": { ... },
  "feedback": "user's correction text"
}
```

### Response schema
```json
{
  "summary": "string — formatted as 'YEAR — Name (dates)' or 'YEAR — Event'",
  "description": "string — factual description (role, significance, key facts)",
  "location": "string | null",
  "date": "string — YYYY-MM-DD format",
  "recurrence": "NONE | DAILY | WEEKLY | MONTHLY | YEARLY",
  "sourceUrl": "string — Wikipedia or authoritative source URL",
  "photoUrl": "string | null — Wikimedia Commons or other image URL"
}
```

**Note:** `sourceUrl` and `photoUrl` are returned as separate fields for structured access. The backend assembles the final description by combining the context text with labeled `Source:` and `Photo:` lines.

## API Design

### `POST /api/events/ai-create`
**Purpose:** AI-generate event fields from a subject

**Request:**
```json
{
  "title": "Taras Shevchenko",
  "calendarId": "abc123",
  "calendarName": "Birthday",
  "modelName": "gemini-2.0-flash",
  "currentFields": null,
  "feedback": null
}
```

**Response (success):**
```json
{
  "success": true,
  "event": {
    "summary": "1814 — Тарас Шевченко (��. 1861)",
    "description": "Український поет, письменник, художник і національний гер��й. Автор \"Кобзаря\", засновник нової української літератури.",
    "location": "Моринці, Київська губернія",
    "date": "1814-03-09",
    "recurrence": "YEARLY",
    "sourceUrl": "https://uk.wikipedia.org/wiki/Шевче��ко_Тарас_Григорович",
    "photoUrl": "https://upload.wikimedia.org/wikipedia/commons/.../Taras_Shevchenko.jpg"
  }
}
```

**Note on date:** The AI returns the true historical date. The backend handles the fallback to current year if Google Calendar rejects old dates.

### `POST /api/events` (new endpoint)
**Purpose:** Insert event into Google Calendar

**Request:**
```json
{
  "calendarId": "abc123",
  "summary": "1814 — Тарас Шевченко (п. 1861)",
  "description": "Український пое��, письменник...\n\nSource: https://uk.wikipedia.org/wiki/...\nPhoto: https://upload.wikimedia.org/...",
  "location": "Моринці, Київська губернія",
  "date": "1814-03-09",
  "recurrence": "YEARLY"
}
```

**Notes:**
- **Date is the true historical date.** E.g., Carl Benz died April 4, 1929 → date is `1929-04-04`. Taras Shevchenko born March 9, 1814 → date is `1814-03-09`.
- **Recurrence starts from the historical date.** Yearly recurrence means the event repeats every year from that date forward.
- **Fallback for old dates:** If Google Calendar API rejects a pre-1970 date, fall back to the current/next year's occurrence of the same month-day (e.g., `2026-03-09`) and log a warning.
- For recurring events, use Google Calendar's RRULE format (e.g., `RRULE:FREQ=YEARLY`)
- All events are all-day (use `date` not `dateTime` in Google Calendar API)
- **Notification:** Always add a popup reminder at 9:00 AM on event day.

**Implementation note on 9:00 AM notification:**
For all-day events, Google Calendar reminders use `minutes` relative to midnight at the start of the event day. To trigger at 9:00 AM, set `reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 900 }] }` where 900 = (24*60 - 9*60) = minutes before the end-of-day reference point. The exact offset should be verified during implementation.

## UI Components

### FAB (`ai-create-fab.tsx`)
- Fixed position: `bottom-6 right-6`
- Rounded full, primary color, shadow-lg
- Icon: `Sparkles` from lucide-react
- Hover: scale up slightly, tooltip "Create event with AI"
- z-index above table content

### Dialog (`ai-create-event-dialog.tsx`)
- Uses existing shadcn Dialog component pattern
- Title: "Create Event with AI"
- States: `idle` → `generating` → `review` → `creating`
- Form sections adapt based on state (pre-AI vs post-AI)
- Model selector follows same pattern as `ask-ai-dialog.tsx`

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/dashboard/ai-create-event-dialog.tsx` | Create | Main dialog component |
| `src/components/dashboard/ai-create-fab.tsx` | Create | Floating action button |
| `src/app/api/events/ai-create/route.ts` | Create | AI generation endpoint |
| `src/app/api/events/route.ts` | Modify | Add POST handler for event insertion |
| `src/lib/google/create-event.ts` | Create | Google Calendar `events.insert()` wrapper |
| `src/app/dashboard/page.tsx` | Modify | Add FAB + dialog to dashboard |
| `src/hooks/use-events.ts` | Modify | Add `refresh()` / `mutate()` function |
