"use client";

import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Icons } from "@v1/ui/icons";
import { Switch } from "@v1/ui/switch";
import { toast } from "@v1/ui/sonner";
import { useEffect, useRef, useState } from "react";
import { Button } from "@v1/ui/button";

interface Brand {
  id: string;
  name: string;
  country_code?: string | null;
}

export function SetCarousel() {
  const [productCount, setProductCount] = useState<string>("");

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-4">
      <div className="flex flex-row justify-between items-center">
        <p className="type-p !font-medium text-primary">Product carousel</p>
        <Switch
          checked={true}
          onCheckedChange={() => {}}
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
          iconPosition="right"
          icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
        >
          Manage products
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
          checked={true}
          onCheckedChange={() => {}}
          className="max-w-[250px]"
        />
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Show Price */}
      <div className="flex flex-row justify-between items-center">
        <Label>Show price</Label>
        <Switch
          checked={true}
          onCheckedChange={() => {}}
          className="max-w-[250px]"
        />
      </div>
    </div>
  );
}
