"use client";

import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Icons } from "@v1/ui/icons";
import { Switch } from "@v1/ui/switch";
import { useState } from "react";
import { Button } from "@v1/ui/button";

interface SetCarouselProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function SetCarousel({ enabled, onEnabledChange }: SetCarouselProps) {
  // Local state for options not yet in ThemeConfig
  // TODO: Add these to ThemeConfig when needed
  const [productCount, setProductCount] = useState<string>("");
  const [showTitle, setShowTitle] = useState(true);
  const [showPrice, setShowPrice] = useState(true);

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-4">
      <div className="flex flex-row justify-between items-center">
        <p className="type-p !font-medium text-primary">Product carousel</p>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="max-w-[250px]"
        />
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Products */}
      <div className="flex flex-row justify-between items-center">
        <Label>Products</Label>
        <Button
          variant="ghost"
          size="icon-sm"
        >
          <span className="px-1">Manage products</span>
          <Icons.ChevronRight className="h-[14px] w-[14px]" />
        </Button>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Product Count */}
      <div className="flex flex-row justify-between items-center">
        <Label>Product count</Label>
        <Input
          placeholder="Product count"
          value={productCount}
          onChange={(e) => setProductCount(e.target.value)}
          className="max-w-[250px]"
          variant="small"
        />
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Show Title */}
      <div className="flex flex-row justify-between items-center">
        <Label>Show title</Label>
        <Switch
          checked={showTitle}
          onCheckedChange={setShowTitle}
          className="max-w-[250px]"
        />
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Show Price */}
      <div className="flex flex-row justify-between items-center">
        <Label>Show price</Label>
        <Switch
          checked={showPrice}
          onCheckedChange={setShowPrice}
          className="max-w-[250px]"
        />
      </div>
    </div>
  );
}
