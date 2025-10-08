"use client";

import * as React from "react";
import { cn } from "../utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Icons } from "./icons";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  inline?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  disabled = false,
  className,
  minDate,
  maxDate,
  inline = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Format date to DD/MM/YYYY
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Parse DD/MM/YYYY to Date
  const parseDate = (input: string): Date | null => {
    const parts = input.split("/");
    if (parts.length !== 3) return null;
    
    const day = Number.parseInt(parts[0] ?? "", 10);
    const month = Number.parseInt(parts[1] ?? "", 10);
    const year = Number.parseInt(parts[2] ?? "", 10);
    
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
    
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) return null; // Invalid date like 31/02/2024
    
    return date;
  };

  // Sync input value when external value changes
  React.useEffect(() => {
    setInputValue(formatDate(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Only allow numbers and slashes
    if (input !== "" && !/^[\d/]*$/.test(input)) return;
    setInputValue(input);
  };

  const handleInputBlur = () => {
    const parsed = parseDate(inputValue);
    if (parsed) {
      onChange(parsed);
      setInputValue(formatDate(parsed));
    } else if (inputValue === "") {
      onChange(null);
    } else {
      // Invalid format, revert to current value
      setInputValue(formatDate(value));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative flex w-full", className)}>
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={disabled}
            className="h-9 pr-10"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
            }}
          />
          <Button
            variant="ghost"
            disabled={disabled}
            className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
            onClick={(e) => {
              e.preventDefault();
              setOpen(!open);
            }}
          >
            <Icons.Calendar className="h-3.5 w-3.5 text-secondary" />
            <span className="sr-only">Select date</span>
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-fit p-0" 
        align="start" 
        side="bottom"
        sideOffset={4}
        alignOffset={0}
        inline={inline}
      >
        <Calendar
          mode="single"
          selected={value ?? undefined}
          captionLayout="dropdown"
          onSelect={(date) => {
            onChange(date ?? null);
            setInputValue(formatDate(date ?? null));
          }}
          fromDate={minDate}
          toDate={maxDate}
          fromYear={1900}
          toYear={2100}
        />
      </PopoverContent>
    </Popover>
  );
}