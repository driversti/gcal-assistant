"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  date: Date;
  onDateChange: (date: Date) => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function DatePicker({ date, onDateChange }: DatePickerProps) {
  function goToPreviousDay() {
    const prev = new Date(date);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev);
  }

  function goToNextDay() {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    onDateChange(next);
  }

  function goToToday() {
    onDateChange(new Date());
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={goToToday}>
        Today
      </Button>
      <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={goToNextDay}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "min-w-[280px] justify-start text-left font-normal"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDate(date)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(d) => d && onDateChange(d)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
