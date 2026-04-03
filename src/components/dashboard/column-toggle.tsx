"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";

export type ColumnKey =
  | "calendar"
  | "summary"
  | "start"
  | "end"
  | "location"
  | "description"
  | "status"
  | "created"
  | "updated";

export const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "summary", label: "Summary" },
  { key: "start", label: "Start" },
  { key: "end", label: "End" },
  { key: "location", label: "Location" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
];

export const DEFAULT_COLUMNS: ColumnKey[] = [
  "calendar",
  "summary",
  "start",
  "end",
  "location",
];

interface ColumnToggleProps {
  visibleColumns: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
}

export function ColumnToggle({ visibleColumns, onToggle }: ColumnToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Settings2 className="mr-2 h-4 w-4" />
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ALL_COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visibleColumns.includes(col.key)}
            onCheckedChange={() => onToggle(col.key)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
