"use client";

/**
 * IdentifiersSidebar
 *
 * Sidebar component for product forms showing:
 * - Product handle input
 * - Manufacturer select
 */

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectSearch,
  SelectTrigger,
} from "@v1/ui/select";
import { useMemo, useState } from "react";
import {
  type ManufacturerData,
  ManufacturerSheet,
} from "../../../sheets/manufacturer-sheet";

interface IdentifiersSidebarProps {
  productHandle: string;
  setProductHandle: (value: string) => void;
  manufacturerId: string | null;
  setManufacturerId: (value: string | null) => void;
  productHandleError?: string;
  productHandleInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function IdentifiersSidebar({
  productHandle,
  setProductHandle,
  manufacturerId,
  setManufacturerId,
  productHandleError,
  productHandleInputRef,
}: IdentifiersSidebarProps) {
  const { manufacturers: apiBrandOptions } = useBrandCatalog();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingManufacturerName, setPendingManufacturerName] = useState("");

  const options = useMemo(
    () =>
      apiBrandOptions.map((brand: { id: string; name: string }) => ({
        value: brand.id,
        label: brand.name,
      })),
    [apiBrandOptions],
  );

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const query = searchTerm.toLowerCase().trim();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchTerm]);

  const selectedOption = options.find((o) => o.value === manufacturerId);
  const displayValue = selectedOption?.label || "Select manufacturer";
  const isPlaceholder = !selectedOption;

  const showCreateOption =
    searchTerm.trim() &&
    !options.some(
      (o) => o.label.toLowerCase() === searchTerm.trim().toLowerCase(),
    );

  const handleSelect = (value: string) => {
    setManufacturerId(value);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCreate = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      setPendingManufacturerName(trimmed);
      setSheetOpen(true);
      setOpen(false);
      setSearchTerm("");
    }
  };

  const handleManufacturerCreated = (manufacturerData: ManufacturerData) => {
    // Auto-select the newly created manufacturer
    setManufacturerId(manufacturerData.id);
  };

  return (
    <>
      <div className="border border-border bg-background p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Identifiers</p>

        {/* Product Identifier */}
        <div className="space-y-1.5">
          <Label>
            Product handle <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={productHandleInputRef}
            value={productHandle}
            onChange={(e) => setProductHandle(e.target.value)}
            placeholder="Enter product handle"
            error={Boolean(productHandleError)}
            aria-invalid={Boolean(productHandleError)}
          />
          {productHandleError && (
            <p className="type-small text-destructive">{productHandleError}</p>
          )}
        </div>

        {/* Manufacturer Select */}
        <div className="space-y-1.5">
          <Label>Manufacturer</Label>
          <Select open={open} onOpenChange={setOpen}>
            <SelectTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="w-full justify-between data-[state=open]:bg-accent"
              >
                <span
                  className={cn(
                    "truncate px-1",
                    isPlaceholder && "text-tertiary",
                  )}
                >
                  {displayValue}
                </span>
                <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
              </Button>
            </SelectTrigger>
            <SelectContent shouldFilter={false} inline>
              <SelectSearch
                placeholder="Search..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <SelectList>
                {filteredOptions.length > 0 ? (
                  <SelectGroup>
                    {filteredOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <span className="type-p">{option.label}</span>
                        {manufacturerId === option.value && (
                          <Icons.Check className="h-4 w-4" />
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : showCreateOption ? (
                  <SelectGroup>
                    <SelectItem
                      value={searchTerm.trim()}
                      onSelect={handleCreate}
                    >
                      <div className="flex items-center gap-2">
                        <Icons.Plus className="h-3.5 w-3.5" />
                        <span className="type-p text-primary">
                          Create &quot;{searchTerm.trim()}&quot;
                        </span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                ) : !searchTerm.trim() ? (
                  <SelectEmpty>Start typing to create...</SelectEmpty>
                ) : (
                  <SelectEmpty>No items found.</SelectEmpty>
                )}
              </SelectList>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Manufacturer Sheet */}
      <ManufacturerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialName={pendingManufacturerName}
        onManufacturerCreated={handleManufacturerCreated}
      />
    </>
  );
}
