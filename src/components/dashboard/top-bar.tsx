"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  LogOut,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useSearchEvents } from "@/hooks/use-search-events";
import { SearchResults } from "@/components/dashboard/search-results";
import type { CalendarInfo } from "@/lib/types/calendar";
import type { CalendarEvent } from "@/lib/types/event";

interface TopBarProps {
  date: Date;
  dateString: string;
  onDateChange: (date: Date) => void;
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  totalCalendarCount: number;
  onCalendarToggle: (id: string) => void;
  onSearchSelect: (event: CalendarEvent) => void;
  email: string;
  picture: string | null;
}

export function TopBar({
  date,
  dateString,
  onDateChange,
  calendars,
  selectedCalendarIds,
  totalCalendarCount,
  onCalendarToggle,
  onSearchSelect,
  email,
  picture,
}: TopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(date);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const { results, loading: searchLoading } = useSearchEvents(searchQuery);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [searchOpen, closeSearch]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const hiddenCount = totalCalendarCount - selectedCalendarIds.length;

  const initials = email
    .split("@")[0]
    .split(".")
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  function handlePrevDay() {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev);
  }

  function handleNextDay() {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    onDateChange(next);
  }

  return (
    <div className="relative flex items-center gap-2 border-b px-3 py-2">
      {/* Prev day */}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handlePrevDay}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Date with calendar popover */}
      <Popover
        open={calendarOpen}
        onOpenChange={(open) => {
          setCalendarOpen(open);
          if (open) setDisplayMonth(date);
        }}
      >
        <PopoverTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold hover:bg-accent">
          {dateLabel}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={new Date(1900, 0)}
            endMonth={new Date(2100, 11)}
            selected={date}
            onSelect={(d) => {
              if (d) {
                onDateChange(d);
                setCalendarOpen(false);
              }
            }}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
          />
        </PopoverContent>
      </Popover>

      {/* Next day */}
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleNextDay}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Today button — hidden when search is open */}
      {!searchOpen && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 text-xs"
          onClick={() => onDateChange(new Date())}
        >
          Today
        </Button>
      )}

      {/* Search area */}
      {searchOpen ? (
        <div ref={searchRef} className="relative flex flex-1 items-center gap-1">
          <Input
            autoFocus
            placeholder="Search events…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeSearch();
            }}
            className="h-7 text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={closeSearch}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <SearchResults
            results={results}
            loading={searchLoading}
            query={searchQuery}
            onSelect={(event) => {
              closeSearch();
              onSearchSelect(event);
            }}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Search toggle */}
      {!searchOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      )}

      {/* Filter popover */}
      <Popover>
        <PopoverTrigger className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <Filter className="h-4 w-4" />
          {hiddenCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {hiddenCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Calendars
          </div>
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-1">
              {calendars.map((cal) => (
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
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer border-0 p-0 overflow-hidden" suppressHydrationWarning>
          {picture
            ? <img src={picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            : initials}
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
  );
}
