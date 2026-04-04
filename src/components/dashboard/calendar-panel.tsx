"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, LogOut, Moon, Sun } from "lucide-react";
import type { CalendarInfo } from "@/lib/types/calendar";

interface CalendarPanelProps {
  date: Date;
  onDateChange: (date: Date) => void;
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  onCalendarToggle: (id: string) => void;
  email: string;
  calendarsLoading: boolean;
}

export function CalendarPanel({
  date,
  onDateChange,
  calendars,
  selectedCalendarIds,
  onCalendarToggle,
  email,
  calendarsLoading,
}: CalendarPanelProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const initials = email
    .split("@")[0]
    .split(".")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: Today + Avatar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="text-primary"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer border-0 p-0">
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {email}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mini Calendar (collapsible on mobile) */}
      <div>
        <button
          onClick={() => setCalendarExpanded(!calendarExpanded)}
          className="flex w-full items-center justify-between lg:pointer-events-none"
        >
          <span className="text-lg font-bold">
            {date.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="lg:hidden">
            {calendarExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            calendarExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0 lg:max-h-[400px] lg:opacity-100"
          }`}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onDateChange(d)}
            defaultMonth={date}
            className="mt-2"
          />
        </div>
      </div>

      {/* Calendar Filters */}
      <div>
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Calendars
          <span className="lg:hidden">
            {filtersExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            filtersExpanded ? "max-h-[300px] opacity-100 mt-2" : "max-h-0 opacity-0 lg:max-h-[300px] lg:opacity-100 lg:mt-2"
          }`}
        >
          <ScrollArea className="max-h-[250px]">
            <div className="flex flex-col gap-1">
              {calendarsLoading ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : (
                calendars.map((cal) => (
                  <label
                    key={cal.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={selectedCalendarIds.includes(cal.id)}
                      onCheckedChange={() => onCalendarToggle(cal.id)}
                    />
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    <span className="truncate">{cal.summary}</span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
