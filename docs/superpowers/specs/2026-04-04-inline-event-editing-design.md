# Inline Event Editing

**Date:** 2026-04-04
**Status:** Approved

## Overview

Add inline editing to the events table so users can modify event fields directly — no separate edit page or modal. Quick fields (summary, location) edit in-cell with auto-save on blur. Complex fields (date-time, description, status) use popovers with explicit Save/Cancel. Recurring events prompt for scope (single / this+following / all) before saving.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Edit UX | Inline in the table | Fastest workflow, no context switch |
| Component strategy | Editable cell wrappers (Approach B) | Keeps `events-table.tsx` manageable; each cell type owns its edit UX |
| Save behavior | Auto-save on blur (text), explicit Save (popovers) | Speed for quick edits, deliberate for complex ones |
| Recurring events | Full support (single / this+following / all) | Matches Google Calendar's native behavior |
| Access control | Respect `accessRole` (owner/writer only) | Better UX than failing on API errors |
| Optimistic updates | No | Wait for API confirmation to avoid inconsistent state |

## API Layer

### `updateEvent()` — new function in `src/lib/google/events.ts`

```ts
updateEvent(
  auth: OAuth2Client,
  calendarId: string,
  eventId: string,
  fields: Partial<EventUpdateFields>,
  recurrenceMode?: "single" | "thisAndFollowing" | "all"
): Promise<calendar_v3.Schema$Event>
```

**`EventUpdateFields` type:**

```ts
interface EventUpdateFields {
  summary: string
  description: string | null
  location: string | null
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  status: string
}
```

**Recurrence mode behavior:**

- `"single"` (default) — patch the instance directly using its `eventId`
- `"all"` — patch using the `recurringEventId` (series master)
- `"thisAndFollowing"` — Google's Calendar API does not have a native "this and following" for `events.patch`. Implementation: delete the original instance and all following (via `events.delete` with `sendUpdates` semantics), then create a new series starting from this instance with the updated fields. Alternatively, use `events.instances` to enumerate and patch each one. We'll investigate the simplest reliable approach during implementation.

### `PATCH /api/events/[eventId]` — extended route

The existing route handler currently supports move operations. Extend it to also handle field updates:

**Request body for field update:**

```ts
{
  calendarId: string
  fields: Partial<EventUpdateFields>
  recurrenceMode?: "single" | "thisAndFollowing" | "all"
}
```

**Disambiguation:** If `fields` is present → update event fields. If `sourceCalendarId`/`targetCalendarId` is present → move (existing behavior).

**Response:** `{ success: true, event: CalendarEvent }` or `{ error: string }` with appropriate HTTP status.

## Components

### New directory: `src/components/dashboard/cells/`

Five new components, all receiving a common prop shape:

```ts
interface EditableCellProps {
  event: CalendarEvent
  editable: boolean
  onSave: (
    eventId: string,
    calendarId: string,
    fields: Partial<EventUpdateFields>,
    recurrenceMode?: "single" | "thisAndFollowing" | "all"
  ) => Promise<void>
}
```

### `InlineTextCell`

- **Used for:** `summary`, `location`
- **Behavior:** Click to enter edit mode. Renders an `<input>` styled to match the table cell. Saves on blur, cancels on Escape.
- **Field prop:** `field: "summary" | "location"` to know which field to send in the update.
- **Loading:** Subtle spinner replaces pencil icon while saving.
- **Read-only:** When `editable` is `false`, renders plain text (identical to current behavior).

### `DescriptionPopoverCell`

- **Used for:** `description`
- **Behavior:** Click the truncated text to open a shadcn `<Popover>` with a `<textarea>`.
- **Actions:** Save and Cancel buttons inside the popover.
- **Sizing:** Textarea with reasonable default height, expandable.

### `DateTimePopoverCell`

- **Used for:** `start`, `end`
- **Behavior:** Click the date/time text to open a popover containing:
  - Date picker (reuse existing shadcn calendar / `react-day-picker`)
  - Time inputs (hour:minute) — hidden when `isAllDay` is true
  - `isAllDay` toggle — switching to all-day strips time; switching off defaults to 00:00-01:00
- **Validation:** End must be >= Start. Save button disabled if invalid.
- **Actions:** Save and Cancel buttons.
- **Linked behavior:** When editing `start`, if `end` would become earlier, auto-adjust `end` to maintain the original duration.

### `StatusDropdownCell`

- **Used for:** `status`
- **Behavior:** Click to open shadcn `<DropdownMenu>` with options: Confirmed, Tentative, Cancelled.
- **Save:** Auto-saves on selection (single click = done). No explicit Save button needed.

### `RecurrenceDialog`

- **Not a cell** — a shared dialog component.
- **Triggered:** Before saving, when the event has a `recurringEventId`.
- **Content:** Three radio options:
  1. "Only this event"
  2. "This and following events"
  3. "All events in the series"
- **Action:** Confirm button triggers the actual save with the chosen `recurrenceMode`.
- **Edge case:** If the event is the first instance in a series, "this and following" behaves the same as "all".

## Integration with EventsTable

### New props on `EventsTable`

```ts
calendars: CalendarInfo[]
onUpdateEvent: (
  eventId: string,
  calendarId: string,
  fields: Partial<EventUpdateFields>,
  recurrenceMode?: "single" | "thisAndFollowing" | "all"
) => Promise<void>
```

### Cell rendering changes

For each editable column, render the corresponding editable cell component instead of plain text:

| Column | Component | Edit style |
|---|---|---|
| `summary` | `InlineTextCell` | In-cell input, auto-save |
| `location` | `InlineTextCell` | In-cell input, auto-save |
| `description` | `DescriptionPopoverCell` | Popover textarea, explicit save |
| `start` | `DateTimePopoverCell` | Popover date-time picker, explicit save |
| `end` | `DateTimePopoverCell` | Popover date-time picker, explicit save |
| `status` | `StatusDropdownCell` | Dropdown, auto-save on selection |

Non-editable columns (`calendar`, `created`, `updated`) remain plain text.

### Editability determination

```ts
const editable = calendars.find(c => c.id === event.calendarId)
  ?.accessRole === "owner" || accessRole === "writer"
```

- `owner` or `writer` → editable cells with hover pencil icon
- `reader` or `freeBusyReader` → plain text, no hover effects (identical to current)

### Visual cues

- **Editable cells:** Subtle pencil icon on hover, light underline or background change on hover
- **Currently editing:** Cell input/popover is visually active
- **Saving:** Small spinner replacing the pencil icon
- **Error:** Red border on the cell + tooltip with error message, auto-clears after a few seconds

## Dashboard Page Changes

### `handleUpdateEvent` function in `dashboard/page.tsx`

```ts
async function handleUpdateEvent(
  eventId: string,
  calendarId: string,
  fields: Partial<EventUpdateFields>,
  recurrenceMode?: "single" | "thisAndFollowing" | "all"
) {
  // 1. Call PATCH /api/events/[eventId]
  // 2. On success → refetch() from useEvents
  // 3. On error → throw (cell component handles display)
}
```

### New data flow

- Pass `calendars` (from `useCalendars`) down to `EventsTable`
- Pass `handleUpdateEvent` down to `EventsTable` as `onUpdateEvent`
- `EventsTable` passes it through to each editable cell component

## Error Handling

| Scenario | Behavior |
|---|---|
| API error (403, 404, etc.) | Red border on cell, tooltip with error message, auto-clears after 5s |
| Network error | Same as above, with "Retry" hint |
| Validation (end < start) | Save button disabled, inline validation message in popover |
| Empty summary | Allowed (Google Calendar supports it, shows "(No title)") |
| All-day toggle | Switching to all-day strips time; switching off defaults to 00:00-01:00 |

## Recurring Event Edge Cases

- **No `recurringEventId`** → skip recurrence dialog, save directly
- **"This and following" on first instance** → treat as "All events"
- **After editing any recurring event** → refetch the full day since multiple rows may have changed
- **Series master not visible** → "All events" still works via the API using `recurringEventId`

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/types/event-update.ts` | `EventUpdateFields` interface |
| `src/components/dashboard/cells/inline-text-cell.tsx` | Inline text editing for summary/location |
| `src/components/dashboard/cells/description-popover-cell.tsx` | Popover textarea for description |
| `src/components/dashboard/cells/date-time-popover-cell.tsx` | Popover date-time picker for start/end |
| `src/components/dashboard/cells/status-dropdown-cell.tsx` | Dropdown for status |
| `src/components/dashboard/cells/recurrence-dialog.tsx` | Recurring event scope selection |

## Files to Modify

| File | Changes |
|---|---|
| `src/lib/google/events.ts` | Add `updateEvent()` function |
| `src/app/api/events/[eventId]/route.ts` | Extend PATCH handler for field updates |
| `src/components/dashboard/events-table.tsx` | Replace static cells with editable cell components |
| `src/app/dashboard/page.tsx` | Add `handleUpdateEvent`, pass calendars + handler to table |
