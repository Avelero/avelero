"use client";

import {
  useSetActiveBrandMutation,
  useUserBrandsQuery,
  useUserBrandsQuerySuspense,
} from "@/hooks/use-brand";
import {
  type CurrentUser,
  useUserQuery,
  useUserQuerySuspense,
} from "@/hooks/use-user";
import { SmartAvatar } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { SignedAvatar } from "./signed-avatar";

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  role: "owner" | "member" | null;
  canLeave?: boolean;
  email?: string | null;
  country_code?: string | null;
  avatar_hue?: number | null;
}

interface BrandDropdownProps {
  isExpanded: boolean;
  onPopupChange: (isOpen: boolean) => void;
}

function BrandAvatar() {
  const { data: brandsData } = useUserBrandsQuerySuspense();
  const { data: user } = useUserQuerySuspense();
  const brands = (brandsData as Brand[] | undefined) ?? [];
  const activeBrand = brands.find(
    (b) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  return (
    <SignedAvatar
      bucket="brand-avatars"
      size={24}
      name={activeBrand?.name}
      url={activeBrand?.logo_url ?? undefined}
      hue={activeBrand?.avatar_hue ?? undefined}
    />
  );
}

export function BrandDropdown({
  isExpanded,
  onPopupChange,
}: BrandDropdownProps) {
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const setActiveBrandMutation = useSetActiveBrandMutation();

  const brands: Brand[] = (brandsData as Brand[] | undefined) ?? [];
  const currentUser = user as CurrentUser | null | undefined;
  const activeBrand = brands.find((b: Brand) => b.id === currentUser?.brand_id);

  const handleBrandSelect = (brandId: string) => {
    if (brandId !== currentUser?.brand_id) {
      setActiveBrandMutation.mutate({ brand_id: brandId });
    }
  };

  return (
    <DropdownMenu onOpenChange={onPopupChange}>
      <DropdownMenuTrigger asChild>
        {/* Button is the sole interactive host. All visuals are inside. */}
        <Button
          variant="ghost"
          className={cn(
            "relative group h-10 w-full p-0 bg-transparent hover:bg-transparent",
            "justify-start overflow-hidden",
          )}
        >
          {/* Expanding rail: 40px when collapsed, full inner width when expanded */}
          <div
            className={cn(
              "absolute top-0 h-10 border border-transparent",
              "transition-all duration-150 ease-out",
              isExpanded ? "left-0 right-0" : "left-0 w-10",
            )}
          />

          {/* Icon block: fixed 40×40, anchored to inner left edge */}
          <div className="absolute inset-y-0 left-0 w-10 h-10 flex items-center justify-center pointer-events-none">
            <Suspense fallback={<SmartAvatar size={24} loading />}>
              <BrandAvatar />
            </Suspense>
          </div>

          {/* Label: always mounted, fades in on expand. Starts at 48px (40 icon + 8 gap). */}
          <div
            className={cn(
              "absolute inset-y-0 left-10 right-6 flex items-center pointer-events-none",
              "transition-opacity duration-150 ease-out",
              isExpanded ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="type-p !font-medium truncate text-secondary transition-colors group-hover:text-primary">
              {activeBrand?.name ?? "No Brand"}
            </span>
          </div>

          {/* Chevron: always mounted, same timing as label, synced fade with slight slide. */}
          <div
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none",
              "transition-all duration-150 ease-out",
              isExpanded
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-1",
            )}
          >
            <Icons.ChevronsUpDown className="h-4 w-4 text-secondary transition-colors group-hover:text-primary" />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[240px]"
        sideOffset={8} // match the 8px grid of the sidebar padding
        align="start"
      >
        <DropdownMenuLabel>Select Brand</DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {brands.map((brand: Brand) => (
            <DropdownMenuItem
              key={brand.id}
              className={cn(
                "cursor-pointer",
                currentUser?.brand_id === brand.id && "bg-accent",
              )}
              onClick={() => handleBrandSelect(brand.id)}
            >
              <span className="type-p truncate">{brand.name}</span>
              {currentUser?.brand_id === brand.id && (
                <Icons.Check className="ml-auto h-4 w-4 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <Link href="/create-brand">
            <DropdownMenuItem className="cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="type-p">Create Brand</span>
              </div>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
