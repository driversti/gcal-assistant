# GCA Dashboard — Unified Timeline Redesign

**Status:** Approved  
**Date:** 2026-04-04  
**Supersedes:** `2026-04-04-mobile-first-redesign.md`

## Goal

Replace the current dual-layout dashboard (card list on mobile, table on desktop) with a single unified vertical timeline that works at every screen width without breakpoint-driven layout switching.

## Problem

The current `lg:` (1024px) breakpoint approach has three issues:
1. Below 1024px the mobile card layout is too stretched on tablets
2. Between 1024–1600px the sidebar + table layout is too cramped
3. The jump between card view and table view feels like two different apps

## Design Principles

- **One layout everywhere.** Components adapt fluidly to available width — no CSS breakpoint toggles between different component trees.
- **All-day events are first-class.** The majority of events are all-day; the design must treat them as primary content, not an afterthought.
- **One event at a time.** No bulk selection. Actions (delete, move, edit) happen per-event via a menu.

---

## Layout Structure

### Top Bar

A single horizontal bar at the top of the viewport:

```
[ ‹ ] [ Friday, Apr 4 ▼ ] [ TODAY ] [ filter-icon ] [ avatar ]
```

| Element | Behavior |
|---|---|
| `‹` / `›` arrows | Navigate to previous/next day |
| Date label with `▼` | Tapping opens a **popover** containing the mini calendar (react-day-picker). Selecting a date navigates and closes the popover. |
| TODAY button | Navigates to today's date |
| Filter icon | Opens a **popover** with calendar checkboxes (same data as current CalendarFilter). A badge on the icon shows count of hidden calendars, if any. |
| Avatar circle | Opens a **dropdown** with: user email (display only), theme toggle (light/dark), sign out |

The top bar uses flexbox with `gap` and wraps naturally. On very narrow screens the arrows and TODAY button may shrink, but all elements remain accessible. No elements are hidden at any width.

### Main Content Area

Below the top bar, the full remaining viewport height is a scrollable area containing:

1. **All-day event banners** (if any exist for the day)
2. **Vertical timeline** of timed events (if any exist)

If the day has only all-day events, the timeline section is not rendered. If the day has only timed events, the banner section is not rendered.

---

## All-Day Event Banners

Displayed as a vertical stack of full-width cards at the top of the content area.

Each banner:
- Has a subtle gradient background tinted with the calendar's color (e.g., `rgba(calColor, 0.15)` fading to transparent)
- Left border (3px) in the calendar's color
- Shows: calendar color dot, event summary, calendar name on the right
- Tapping the banner opens the edit panel
- Three-dot menu icon on the right for quick actions

A small section header "All Day" appears above the banners in muted uppercase text.

---

## Vertical Timeline

Displayed below the all-day banners (separated by a subtle divider line).

**Structure:**
- Left column (~40px): hour markers (e.g., "09", "10", "14") with a vertical line connecting them
- Right column (flex: 1): event cards anchored to their start time

**Hour markers:**
- Only hours that have events are shown (no empty hour slots)
- The current hour marker is highlighted in the accent color (teal)
- Past hour markers are dimmed
- A connecting vertical line runs between markers; the segment from start-of-day to current time uses the accent color, the rest is muted

**Event cards:**
- Background: `card` background color (follows theme)
- Left border (3px) in the calendar's color
- Content: event summary (bold), time range + calendar name (muted, small)
- Location line if present (muted, with pin icon)
- Duplicate badge inline if the event is in a duplicate group (amber "DUP" pill)
- Recurring badge if event has a recurringEventId (muted "Recurring" pill)
- Three-dot menu icon for actions
- Cards are stacked vertically with small gaps; they grow/shrink fluidly with the content width

---

## Event Actions (Three-Dot Menu)

Each event card (both all-day banners and timeline cards) has a three-dot (`...`) icon button. Tapping opens a dropdown menu:

| Action | Behavior |
|---|---|
| **Edit** | Opens the edit panel (same as tapping the card) |
| **Move to...** | Opens the Move dialog (list of calendars to move the event to) |
| **Ask AI** | Opens the Ask AI dialog for this event |
| **Delete** | Deletes the event. If recurring, shows the recurrence mode dialog first (this instance / all events). No confirmation dialog for non-recurring events — keep it snappy. |

---

## Edit Panel

Tapping an event card (or choosing "Edit" from the menu) opens an edit panel.

**Panel behavior by available width:**
- **Narrow (viewport width < 640px):** The panel slides up from the bottom as a sheet, covering approximately 70% of the viewport height. The timeline is still visible peeking above. A drag handle at the top allows the user to dismiss by swiping down.
- **Wide (viewport width >= 640px):** The panel appears as a right-side panel, 400px wide. The timeline content area shrinks to accommodate it. No overlay — both timeline and panel are visible simultaneously.

This width adaptation uses a single `sm:` (640px) Tailwind breakpoint on the panel container — this is the only breakpoint in the entire app. The panel renders the same component tree at all widths; only its positioning CSS changes.

**Panel content (identical at all widths):**
- Header: "Edit Event" + close (X) button
- Calendar badge (color dot + calendar name, read-only)
- Title input
- Start date + start time inputs (side by side; time hidden for all-day)
- End date + end time inputs (side by side; time hidden for all-day)
- Location input
- Description textarea
- Status select (Confirmed / Tentative / Cancelled)
- Footer: "Save" button, "Delete" button (destructive style)

**Recurring events:** When saving changes to a recurring event, the recurrence mode dialog appears (This event / All events) before the API call is made.

---

## Removed Features

| Feature | Reason |
|---|---|
| Events table | Replaced entirely by the timeline view |
| Bulk select / bulk actions bar | Replaced by per-event three-dot menu |
| Segmented control (All / Duplicates / All Day) | Timeline naturally separates all-day from timed; duplicate badges are visible inline |
| Sidebar calendar panel | Replaced by top bar with popovers |
| Event comparison | Already removed in previous iteration |
| Swipe gestures on cards | Replaced by three-dot menu for consistency across touch and mouse |
| Column toggle | No table, no columns |

---

## Kept Features (Unchanged)

| Feature | Notes |
|---|---|
| AI create event FAB + dialog | Floating action button in bottom-right corner |
| Duplicate detection | Same algorithm; displayed as inline badge on cards |
| Calendar color coding | Used for left borders, color dots, all-day gradients |
| Teal accent color | Primary color remains teal (oklch) |
| Light/dark theme toggle | In avatar dropdown |
| Date URL sync | `?date=YYYY-MM-DD` query parameter stays |
| Calendar selection persistence | localStorage `gca:selectedCalendarIds` stays |

---

## Component Architecture

### Files to Create
- `src/components/dashboard/top-bar.tsx` — date nav, today button, filter popover, avatar dropdown
- `src/components/dashboard/timeline-view.tsx` — main timeline layout: all-day banners + timed event cards
- `src/components/dashboard/event-card.tsx` — single event card used in both banner and timeline sections
- `src/components/dashboard/event-actions-menu.tsx` — three-dot dropdown menu (delete, move, edit, ask AI)
- `src/components/dashboard/edit-panel.tsx` — responsive edit panel (bottom sheet on narrow, side panel on wide)

### Files to Modify
- `src/app/dashboard/page.tsx` — rewrite to use new components
- `src/app/dashboard/layout.tsx` — simplify if needed

### Files to Delete
- `src/components/dashboard/calendar-panel.tsx` — replaced by top-bar
- `src/components/dashboard/event-card-list.tsx` — replaced by timeline-view
- `src/components/dashboard/event-edit-sheet.tsx` — replaced by edit-panel
- `src/components/dashboard/events-table.tsx` — no longer needed
- `src/components/dashboard/bulk-actions-bar.tsx` — no bulk actions
- `src/components/dashboard/segmented-control.tsx` — no segments
- `src/components/dashboard/column-toggle.tsx` — no columns
- `src/components/dashboard/date-picker.tsx` — date picking moves to top-bar popover

### Files to Keep
- `src/components/dashboard/ai-create-fab.tsx`
- `src/components/dashboard/ai-create-event-dialog.tsx`
- `src/components/dashboard/ask-ai-dialog.tsx`
- `src/components/dashboard/move-dialog.tsx`
- `src/components/dashboard/cells/recurrence-dialog.tsx`

---

## Tech Constraints

- **Next.js 16 + React 19** — check `node_modules/next/dist/docs/` before writing any code
- **Tailwind CSS v4** — utility-first, CSS custom properties in oklch
- **shadcn/ui (Base UI variant, NOT Radix)** — `DropdownMenuTrigger` does not support `asChild`
- **react-day-picker v9** — `classNames` prop replaces built-in classes; `table` key doesn't apply to rendered `<table>` element
- **No new dependencies** — build everything with existing UI primitives
