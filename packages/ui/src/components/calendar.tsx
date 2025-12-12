"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "../components/button";
import { cn } from "../utils";

type CalendarView = "date" | "month" | "year";

interface CalendarProps {
  className?: string;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  mode?: "single";
  fromDate?: Date;
  toDate?: Date;
  fromYear?: number;
  toYear?: number;
  defaultMonth?: Date;
  captionLayout?: "label" | "dropdown"; // Kept for API compat, but we ignore "dropdown"
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function Calendar({
  className,
  selected,
  onSelect,
  fromDate,
  toDate,
  fromYear = 1900,
  toYear = 2100,
  defaultMonth,
}: CalendarProps) {
  // The month being displayed (not necessarily the selected date's month)
  const [displayDate, setDisplayDate] = React.useState<Date>(() => {
    return selected ?? defaultMonth ?? new Date();
  });

  const [view, setView] = React.useState<CalendarView>("date");

  // Update display date when selected changes externally
  React.useEffect(() => {
    if (selected) {
      setDisplayDate(selected);
    }
  }, [selected]);

  const displayMonth = displayDate.getMonth();
  const displayYear = displayDate.getFullYear();

  // Navigate months (only in date view)
  const goToPrevMonth = () => {
    setDisplayDate(new Date(displayYear, displayMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setDisplayDate(new Date(displayYear, displayMonth + 1, 1));
  };

  // Check if a date is disabled
  const isDateDisabled = (date: Date) => {
    if (fromDate && date < new Date(fromDate.setHours(0, 0, 0, 0))) return true;
    if (toDate && date > new Date(toDate.setHours(23, 59, 59, 999)))
      return true;
    return false;
  };

  // Check if prev/next month buttons should be disabled
  const isPrevMonthDisabled = fromDate
    ? new Date(displayYear, displayMonth, 0) < fromDate
    : false;
  const isNextMonthDisabled = toDate
    ? new Date(displayYear, displayMonth + 1, 1) > toDate
    : false;

  // Handle month selection
  const handleMonthSelect = (month: number) => {
    setDisplayDate(new Date(displayYear, month, 1));
    setView("date");
  };

  // Handle year selection
  const handleYearSelect = (year: number) => {
    setDisplayDate(new Date(year, displayMonth, 1));
    setView("month"); // Go to month view after selecting year
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return;
    onSelect?.(date);
  };

  // Get the years to display (3x3 grid centered on current decade)
  const getYearsGrid = () => {
    const startYear = Math.floor(displayYear / 10) * 10 - 1;
    return Array.from({ length: 12 }, (_, i) => startYear + i);
  };

  // Navigate years grid
  const goToPrevYears = () => {
    setDisplayDate(new Date(displayYear - 10, displayMonth, 1));
  };

  const goToNextYears = () => {
    setDisplayDate(new Date(displayYear + 10, displayMonth, 1));
  };

  // Navigate years in month view
  const goToPrevYear = () => {
    setDisplayDate(new Date(displayYear - 1, displayMonth, 1));
  };

  const goToNextYear = () => {
    setDisplayDate(new Date(displayYear + 1, displayMonth, 1));
  };

  return (
    <div
      data-slot="calendar"
      className={cn(
        "bg-background p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        className,
      )}
    >
      <div className="w-fit">
        {/* Header */}
        <div className="relative flex items-center justify-between mb-2">
          {/* Prev button */}
          <Button
            variant="ghost"
            className="h-[--cell-size] w-[--cell-size] p-0 text-primary"
            onClick={() => {
              if (view === "date") goToPrevMonth();
              else if (view === "month") goToPrevYear();
              else if (view === "year") goToPrevYears();
            }}
            disabled={view === "date" && isPrevMonthDisabled}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>

          {/* Caption */}
          <div className="flex items-center gap-1">
            {view === "date" && (
              <>
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className={cn(
                    "px-2 py-1 text-primary type-p font-medium hover:bg-accent cursor-pointer select-none",
                  )}
                >
                  {MONTH_FULL[displayMonth]}
                </button>
                <button
                  type="button"
                  onClick={() => setView("year")}
                  className={cn(
                    "px-2 py-1 text-primary type-p font-medium hover:bg-accent cursor-pointer select-none",
                  )}
                >
                  {displayYear}
                </button>
              </>
            )}
            {view === "month" && (
              <button
                type="button"
                onClick={() => setView("year")}
                className={cn(
                  "px-2 py-1 text-primary type-p font-medium hover:bg-accent cursor-pointer select-none",
                )}
              >
                {displayYear}
              </button>
            )}
            {view === "year" && (
              <span className="px-2 py-1 text-primary type-p font-medium select-none">
                {getYearsGrid()[0]} – {getYearsGrid()[11]}
              </span>
            )}
          </div>

          {/* Next button */}
          <Button
            variant="ghost"
            className="h-[--cell-size] w-[--cell-size] p-0 text-primary"
            onClick={() => {
              if (view === "date") goToNextMonth();
              else if (view === "month") goToNextYear();
              else if (view === "year") goToNextYears();
            }}
            disabled={view === "date" && isNextMonthDisabled}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        {/* Date View */}
        {view === "date" && (
          <DateView
            displayMonth={displayMonth}
            displayYear={displayYear}
            selected={selected}
            onSelect={handleDateSelect}
            isDateDisabled={isDateDisabled}
          />
        )}

        {/* Month View */}
        {view === "month" && (
          <MonthView displayMonth={displayMonth} onSelect={handleMonthSelect} />
        )}

        {/* Year View */}
        {view === "year" && (
          <YearView
            years={getYearsGrid()}
            displayYear={displayYear}
            fromYear={fromYear}
            toYear={toYear}
            onSelect={handleYearSelect}
          />
        )}
      </div>
    </div>
  );
}

// Date View Component
interface DateViewProps {
  displayMonth: number;
  displayYear: number;
  selected?: Date;
  onSelect: (date: Date) => void;
  isDateDisabled: (date: Date) => boolean;
}

function DateView({
  displayMonth,
  displayYear,
  selected,
  onSelect,
  isDateDisabled,
}: DateViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get days for the calendar grid
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(displayYear, displayMonth);
  const firstDay = getFirstDayOfMonth(displayYear, displayMonth);

  // Previous month days to show
  const prevMonthDays = getDaysInMonth(displayYear, displayMonth - 1);
  const prevDays = Array.from({ length: firstDay }, (_, i) => ({
    day: prevMonthDays - firstDay + i + 1,
    date: new Date(
      displayYear,
      displayMonth - 1,
      prevMonthDays - firstDay + i + 1,
    ),
    isOutside: true,
  }));

  // Current month days
  const currentDays = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    date: new Date(displayYear, displayMonth, i + 1),
    isOutside: false,
  }));

  // Next month days to fill the grid
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const nextDaysCount = totalCells - prevDays.length - currentDays.length;
  const nextDays = Array.from({ length: nextDaysCount }, (_, i) => ({
    day: i + 1,
    date: new Date(displayYear, displayMonth + 1, i + 1),
    isOutside: true,
  }));

  const allDays = [...prevDays, ...currentDays, ...nextDays];

  const isSelected = (date: Date) => {
    if (!selected) return false;
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="h-[--cell-size] flex items-center justify-center text-tertiary type-small font-normal select-none"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {allDays.map(({ day, date, isOutside }) => {
          const disabled = isDateDisabled(date);
          const selectedDay = isSelected(date);
          const todayDay = isToday(date);
          const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(date)}
              className={cn(
                "h-[--cell-size] w-[--cell-size] flex items-center justify-center type-p font-normal cursor-pointer select-none",
                isOutside ? "text-secondary" : "text-primary",
                disabled && "opacity-50 cursor-not-allowed",
                !disabled && !selectedDay && "hover:bg-accent",
                todayDay && !selectedDay && "bg-accent",
                selectedDay && "bg-primary text-primary-foreground",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Month View Component
interface MonthViewProps {
  displayMonth: number;
  onSelect: (month: number) => void;
}

function MonthView({ displayMonth, onSelect }: MonthViewProps) {
  return (
    <div
      className="grid grid-cols-4 gap-1"
      style={{ width: "calc(var(--cell-size) * 7)" }}
    >
      {MONTHS.map((month, index) => (
        <button
          key={month}
          type="button"
          onClick={() => onSelect(index)}
          className={cn(
            "h-10 flex items-center justify-center type-p font-normal cursor-pointer select-none",
            "text-primary hover:bg-accent",
            index === displayMonth &&
              "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {month}
        </button>
      ))}
    </div>
  );
}

// Year View Component
interface YearViewProps {
  years: number[];
  displayYear: number;
  fromYear: number;
  toYear: number;
  onSelect: (year: number) => void;
}

function YearView({
  years,
  displayYear,
  fromYear,
  toYear,
  onSelect,
}: YearViewProps) {
  return (
    <div
      className="grid grid-cols-4 gap-1"
      style={{ width: "calc(var(--cell-size) * 7)" }}
    >
      {years.map((year) => {
        const disabled = year < fromYear || year > toYear;
        const isCurrentYear = year === displayYear;

        return (
          <button
            key={year}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(year)}
            className={cn(
              "h-10 flex items-center justify-center type-p font-normal cursor-pointer select-none",
              "text-primary hover:bg-accent",
              disabled && "opacity-50 cursor-not-allowed",
              isCurrentYear &&
                "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}

// For backwards compatibility, export a simple DayButton (though it's now internal)
function CalendarDayButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "flex items-center justify-center aspect-square h-[--cell-size] w-[--cell-size] p-0 font-normal type-p",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
