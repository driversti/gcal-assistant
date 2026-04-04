# Mobile-First Dashboard Redesign

## Context

The current GCA dashboard is desktop-only: a sidebar + data table layout that is difficult to use on mobile devices. Tables require horizontal scrolling, inline popovers are imprecise on touch, and the sidebar wastes mobile screen space. This redesign makes the app mobile-first using the **Design 3 (Calendar + Bottom Drawer)** aesthetic while preserving full desktop functionality through a hybrid approach.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Layout strategy | **Hybrid** — cards on mobile, table on desktop |
| Breakpoint | `lg:` (1024px) separates mobile from desktop |
| Header | **Minimal** — no header bar; avatar in calendar panel |
| Primary accent | **Teal** (`#0d9488` light / `#2dd4bf` dark) |
| Mobile editing | **Full-screen edit sheet** (tap card → sheet) |
| Mobile selection | **Swipe actions only** (swipe left → delete/move) |
| Desktop editing | **Inline table editing** (same as current) |
| Desktop selection | **Checkboxes + bulk actions bar** (same as current) |
| Comparison panel | **Removed** entirely |

## Architecture

### Breakpoint Strategy

A single breakpoint at `lg:` (1024px) toggles between two layout modes:

- **Mobile (<1024px):** Vertical stack — calendar on top, event list below
- **Desktop (≥1024px):** Horizontal split — calendar panel left, event table right

Both modes share the same data layer, hooks, and state management from `page.tsx`. Only the presentation components differ.

### Component Structure

```
src/components/dashboard/
├── calendar-panel.tsx          # NEW — mini-calendar + calendar filter + avatar dropdown
├── event-card-list.tsx         # NEW — mobile card list with swipe actions
├── event-edit-sheet.tsx        # NEW — full-screen mobile edit sheet
├── events-table.tsx            # MODIFIED — desktop only (lg:), add teal accent styling
├── bulk-actions-bar.tsx        # MODIFIED — desktop only (lg:)
├── ai-create-event-dialog.tsx  # KEPT — works on both sizes
├── ai-create-fab.tsx           # KEPT — repositioned for mobile
├── date-picker.tsx             # MODIFIED — compact mode for mobile
├── column-toggle.tsx           # KEPT — desktop only (lg:)
├── segmented-control.tsx       # NEW — All / Duplicates / All Day filter
├── cells/                      # KEPT — desktop inline editing cells unchanged
│   ├── inline-text-cell.tsx
│   ├── date-time-popover-cell.tsx
│   ├── description-popover-cell.tsx
│   └── status-dropdown-cell.tsx
└── move-dialog.tsx             # EXTRACTED from bulk-actions-bar, reused by swipe action

DELETED:
├── event-comparison.tsx        # Removed
├── calendar-filter.tsx         # Merged into calendar-panel.tsx

MODIFIED:
├── layout/header.tsx           # DELETED — replaced by avatar dropdown in calendar-panel
```

### Page Layout (`page.tsx`)

```
Mobile (<1024px):
┌──────────────────────┐
│ Calendar Panel       │ ← mini-cal + filters + avatar
│ (collapsible)        │
├──────────────────────┤
│ Segmented Control    │ ← All | Duplicates | All Day
├──────────────────────┤
│ Event Card List      │ ← scrollable cards
│  ┌──────────────┐    │
│  │ Event Card   │←───│── swipe left for actions
│  └──────────────┘    │
│  ┌──────────────┐    │
│  │ Event Card   │    │
│  └──────────────┘    │
├──────────────────────┤
│ AI FAB (bottom-right)│
└──────────────────────┘

Desktop (≥1024px):
┌────────────┬─────────────────────────┐
│ Calendar   │ Date Title + Column Tog │
│ Panel      ├─────────────────────────┤
│            │ Segmented Control       │
│ mini-cal   ├─────────────────────────┤
│ filters    │ Bulk Actions Bar        │
│ avatar     ├─────────────────────────┤
│            │ Events Table            │
│            │ (inline editing)        │
│            │                         │
│            │                         │
│            ├─────────────────────────┤
│            │ AI FAB (bottom-right)   │
└────────────┴─────────────────────────┘
```

## New Components

### 1. CalendarPanel (`calendar-panel.tsx`)

Replaces both `header.tsx` and `calendar-filter.tsx`. Contains:

- **Avatar dropdown** (top-right of panel): user avatar with initials, clicking opens dropdown with email display, theme toggle, sign out button
- **Month navigation**: `‹ April 2026 ›` with prev/next arrows
- **Today button**: teal-accented pill
- **Mini-calendar grid**: 7-column grid, selected date highlighted with teal circle, event dots below dates (colored by calendar)
- **Calendar filter**: checkboxes with color dots, same data as current `calendar-filter.tsx`

**Mobile behavior:** Collapsible — tap the date title in the drawer header to collapse/expand the calendar grid. Calendar filter hidden behind a "Calendars" expandable section.

**Desktop behavior:** Fixed left panel, always visible, ~280px wide. Calendar filter always visible below mini-cal.

**Props:** Same data sources as current sidebar — `calendars`, `selectedCalendarIds`, `onToggle`, `date`, `onDateChange`, `email`.

### 2. SegmentedControl (`segmented-control.tsx`)

New filter component replacing the column toggle's role of filtering what's visible:

- Three segments: **All (N)**, **Duplicates (N)**, **All Day (N)**
- Teal highlight on active segment
- Filters the event list/table client-side
- Counts derived from events array and `duplicateGroups` map

**Props:** `events`, `duplicateGroups`, `activeSegment`, `onSegmentChange`

### 3. EventCardList (`event-card-list.tsx`)

Mobile-only event display (hidden on `lg:`):

- Vertical list of event cards grouped by time period (All Day, Morning, Afternoon, Evening)
- Each card shows: time (left column), color bar, title, location, badges (calendar name, recurring, duplicate)
- **Swipe left** reveals action buttons: Move (teal), Delete (red)
- **Tap** opens `EventEditSheet`
- Duplicate cards highlighted with amber border (same as Design 3 mockup)
- Group labels: `ALL DAY`, `MORNING`, `AFTERNOON` — uppercase, small, muted

**Props:** `events`, `calendars`, `duplicateGroups`, `onUpdateEvent`, `onDelete`, `onMove`, `onRefetch`

### 4. EventEditSheet (`event-edit-sheet.tsx`)

Full-screen bottom sheet for editing an event on mobile:

- Slides up from bottom, covers full screen
- Header: event title + close button
- Form fields: Summary, Date/Time (start + end), Location, Description (textarea), Status (select), Recurrence (select)
- Calendar badge (read-only, shows which calendar)
- Save button (teal, full-width) at bottom
- Delete button (destructive, below save)
- Uses same `onUpdateEvent` callback as inline table editing
- For recurring events: shows RecurrenceDialog before saving (same as current)

**Props:** `event`, `calendars`, `open`, `onOpenChange`, `onUpdateEvent`, `onDelete`

### 5. MoveDialog (extracted)

Currently embedded in `bulk-actions-bar.tsx`. Extract to standalone component so both swipe actions (mobile) and bulk actions bar (desktop) can use it.

**Props:** `open`, `onOpenChange`, `calendars`, `onMove`

## Modified Components

### EventsTable

- Wrap in `hidden lg:block` — only visible on desktop
- Replace current neutral styling with teal accents for selected rows, header highlight
- Remove comparison-related code (compare button, comparison panel rendering)
- Keep all inline editing cells unchanged

### BulkActionsBar

- Wrap in `hidden lg:flex` — desktop only
- Remove `onCompare` and `isComparing` props
- Keep delete and move functionality

### DatePicker

- Desktop: same as current
- Mobile: simplified — the CalendarPanel handles date selection directly via the mini-calendar, so DatePicker is desktop-only (`hidden lg:flex`)

### AiCreateFab

- Mobile: `bottom-20 right-4` (above the swipe hint area, smaller)
- Desktop: `bottom-6 right-6` (same as current)
- Both: teal gradient background instead of current default primary

### Dashboard Layout (`layout.tsx`)

- Remove `<Header>` component from the layout
- The `main` element becomes the only child (full viewport)
- Session check and redirect remain unchanged

### page.tsx (State Changes)

- Remove `isComparing` state and `handleCompare` callback
- Remove comparison-related event filtering
- Add `activeSegment` state (`"all" | "duplicates" | "allday"`)
- Add `filteredEvents` derived from `activeSegment`
- Keep all other state unchanged: `selectedCalendarIds`, `visibleColumns`, `selectedIds`, `sidebarOpen`, `aiCreateOpen`, `duplicateGroups`
- `selectedIds` only used on desktop (bulk actions), ignored on mobile

## Color System

Replace the current neutral oklch palette with teal-accented tokens:

```css
/* Light */
--primary: oklch(0.45 0.16 170);        /* teal #0d9488 */
--primary-foreground: oklch(0.98 0 0);   /* white */

/* Dark */
--primary: oklch(0.7 0.15 175);          /* teal #2dd4bf */
--primary-foreground: oklch(0.15 0 0);   /* near-black */
```

All other tokens (background, surface, muted, border, destructive) remain unchanged. The teal replaces only `--primary` and `--primary-foreground`.

Accent colors for calendar dots, badges, and duplicate highlights remain driven by Google Calendar's `backgroundColor` per calendar.

## Responsive Breakpoints

| Range | Layout | Event Display | Selection | Editing |
|-------|--------|--------------|-----------|---------|
| <1024px | Vertical stack | Card list | Swipe actions | Full-screen sheet |
| ≥1024px | Side-by-side | Data table | Checkboxes + bulk bar | Inline cells |

Only one breakpoint: `lg:` (1024px). No intermediate tablet layout — mobile cards work fine up to 1024px.

## Verification

1. **Mobile card list:** Open on phone-width viewport (<1024px). Verify cards render with time, color bar, title, location, badges. Swipe left on a card to see delete/move buttons.
2. **Mobile edit sheet:** Tap a card. Verify full-screen sheet opens with all editable fields. Save and verify event updates. Test with recurring event to verify RecurrenceDialog appears.
3. **Desktop table:** Open on wide viewport (≥1024px). Verify calendar panel on left, table on right. Inline editing works. Bulk select + delete/move works.
4. **Segmented control:** Click Duplicates tab — only duplicate-flagged events show. Click All Day — only all-day events show. Verify counts are correct.
5. **Calendar panel:** Select/deselect calendars. Verify event list filters. Click dates in mini-cal. Verify date changes and events reload.
6. **Avatar dropdown:** Click avatar in calendar panel. Verify email, theme toggle, sign out all work.
7. **AI Create:** Tap FAB on both mobile and desktop. Verify dialog opens and event creation flow works.
8. **Theme:** Toggle light/dark via avatar dropdown. Verify teal accent looks correct in both themes.
9. **Responsive transition:** Resize browser across 1024px boundary. Verify smooth switch between card list and table. No broken layout at boundary.
