# Recurring Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable "Recurring" column to the events table that shows a badge for recurring event instances.

**Architecture:** Use the existing `recurringEventId` field on `CalendarEvent` as a boolean signal. Add the column to the column registry and render a badge in the table.

**Tech Stack:** React, TypeScript, shadcn/ui Badge component

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/dashboard/column-toggle.tsx` | Modify | Add `"recurring"` to ColumnKey type and ALL_COLUMNS |
| `src/components/dashboard/events-table.tsx` | Modify | Add recurring case to renderCell switch |

---

### Task 1: Add "recurring" to column registry

**Files:**
- Modify: `src/components/dashboard/column-toggle.tsx:12-21` (ColumnKey type)
- Modify: `src/components/dashboard/column-toggle.tsx:23-33` (ALL_COLUMNS array)

- [ ] **Step 1: Add `"recurring"` to the `ColumnKey` union type**

In `src/components/dashboard/column-toggle.tsx`, add `"recurring"` to the union:

```typescript
export type ColumnKey =
  | "calendar"
  | "summary"
  | "start"
  | "end"
  | "location"
  | "description"
  | "status"
  | "recurring"
  | "created"
  | "updated";
```

- [ ] **Step 2: Add the column definition to `ALL_COLUMNS`**

In the same file, add the entry after "status":

```typescript
export const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "summary", label: "Summary" },
  { key: "start", label: "Start" },
  { key: "end", label: "End" },
  { key: "location", label: "Location" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "recurring", label: "Recurring" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
];
```

Do **not** add to `DEFAULT_COLUMNS` — this column is opt-in.

- [ ] **Step 3: Verify the app compiles**

Run: `npm run build`
Expected: No TypeScript errors. The new column key is valid but not yet rendered.

---

### Task 2: Render the recurring badge in the events table

**Files:**
- Modify: `src/components/dashboard/events-table.tsx:119-206` (renderCell switch)

- [ ] **Step 1: Add the `"recurring"` case to `renderCell`**

In `src/components/dashboard/events-table.tsx`, add a case before `"created"` in the `renderCell` switch:

```typescript
      case "recurring":
        return event.recurringEventId ? (
          <Badge variant="outline" className="text-xs">
            Recurring
          </Badge>
        ) : null;
```

The `Badge` import already exists at line 13.

- [ ] **Step 2: Verify the app compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual verification**

1. Run `npm run dev` and open the dashboard
2. Click the "Columns" dropdown (gear icon)
3. Verify "Recurring" appears as a toggleable option
4. Enable it — recurring events should show a "Recurring" badge, one-time events should show nothing

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/column-toggle.tsx src/components/dashboard/events-table.tsx
git commit -m "feat: add recurring column to events table"
```
