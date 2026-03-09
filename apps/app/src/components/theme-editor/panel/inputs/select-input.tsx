"use client";

/**
 * Select input for enumerated content fields.
 *
 * Reuses the shared UI select so content configuration can expose discrete
 * options like layout direction without overloading style controls.
 */

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import { useState } from "react";
import type { ContentField } from "@v1/dpp-components";
import { FieldWrapper } from "./field-wrapper";

interface SelectInputProps {
  field: ContentField;
  value: unknown;
  onChange: (value: string) => void;
}

/**
 * Render a dropdown for content fields with a fixed option list.
 */
export function SelectInput({ field, value, onChange }: SelectInputProps) {
  const [open, setOpen] = useState(false);
  const options = field.options ?? [];
  const selectedValue = typeof value === "string" ? value : "";
  const selectedOption = options.find((option) => option.value === selectedValue);
  const displayValue =
    selectedOption?.label ?? field.placeholder ?? "Select...";
  const isPlaceholder = !selectedOption;

  return (
    <FieldWrapper label={field.label}>
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger asChild>
          <Button
            variant="outline"
            size="default"
            className="w-full justify-between data-[state=open]:bg-accent"
          >
            <span
              className={cn("truncate px-1", isPlaceholder && "text-tertiary")}
            >
              {displayValue}
            </span>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </SelectTrigger>

        <SelectContent defaultValue={selectedValue || undefined}>
          <SelectList>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="type-p">{option.label}</span>
                  {selectedValue === option.value ? (
                    <Icons.Check className="h-4 w-4" />
                  ) : null}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectList>
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}
