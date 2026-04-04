# Recurring Column Design

**Date:** 2026-04-04
**Status:** Approved

## Problem

Users cannot distinguish between one-time events and recurring ones in the events table.

## Solution

Add a dedicated, toggleable "Recurring" column to the events table that displays a badge for recurring event instances.

## Design

### Data Source

The `CalendarEvent` type already has `recurringEventId?: string`. When present, the event is an instance of a recurring series. No backend or type changes are needed.

### Changes

**1. `src/components/dashboard/column-toggle.tsx`**
- Add `"recurring"` to the `ColumnKey` union type
- Add `{ key: "recurring", label: "Recurring" }` to `ALL_COLUMNS` after "status"
- Do **not** add to `DEFAULT_COLUMNS` — this is an opt-in column

**2. `src/components/dashboard/events-table.tsx`**
- Add `case "recurring"` to the `renderCell` switch statement
- Render `<Badge variant="outline">Recurring</Badge>` when `event.recurringEventId` exists
- Render nothing for one-time events

### Out of Scope

- Showing recurrence pattern (Weekly, Daily, etc.) — requires fetching master events via extra API calls. Can be added later as an enhancement.

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/column-toggle.tsx` | Add `"recurring"` to ColumnKey and ALL_COLUMNS |
| `src/components/dashboard/events-table.tsx` | Add recurring case to renderCell |
