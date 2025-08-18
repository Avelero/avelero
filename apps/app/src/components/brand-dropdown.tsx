"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Button } from "@v1/ui/button";
import { Avatar, AvatarFallback } from "@v1/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { useUserBrandsQuery, useUserBrandsQuerySuspense, useSetActiveBrandMutation } from "@/hooks/use-brand";
import { useUserQuery, useUserQuerySuspense, CurrentUser } from "@/hooks/use-user";
import { useRouter, useParams } from "next/navigation";
import { Suspense } from "react";

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  avatar_hue?: number | null;
  country_code?: string | null;
}

interface BrandDropdownProps {
  isExpanded: boolean;
  onPopupChange: (isOpen: boolean) => void;
}

function BrandAvatar() {
  const { data: brandsData } = useUserBrandsQuerySuspense();
  const { data: user } = useUserQuerySuspense();
  const brands = (brandsData as { data: Brand[] } | undefined)?.data ?? [];
  const activeBrand = brands.find((b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id);

  return (
    <Avatar 
      className="w-6 h-6"
      src={activeBrand?.logo_url ?? undefined}
      name={activeBrand?.name}
      hue={activeBrand?.avatar_hue ?? undefined}
      width={24}
      height={24}
    />
  );
}

export function BrandDropdown({ isExpanded, onPopupChange }: BrandDropdownProps) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const setActiveBrandMutation = useSetActiveBrandMutation();

  const brands: Brand[] = (brandsData as { data: Brand[] } | undefined)?.data ?? [];
  const currentUser = user as CurrentUser | null | undefined;
  const activeBrand = brands.find((b: Brand) => b.id === currentUser?.brand_id);

  const handleBrandSelect = (brandId: string) => {
    if (brandId !== currentUser?.brand_id) {
      setActiveBrandMutation.mutate({ id: brandId });
    }
  };

  const handleCreateBrand = () => {
    router.push(`/${locale}/brands/create`);
  };

  return (
    <DropdownMenu onOpenChange={onPopupChange}>
      <DropdownMenuTrigger asChild>
        {/* Button is the sole interactive host. All visuals are inside. */}
        <Button
          variant="ghost"
          className={cn(
            "relative group h-10 w-full p-0 bg-transparent hover:bg-transparent",
            "justify-start overflow-hidden"
          )}
        >
          {/* Expanding rail: 40px when collapsed, full inner width when expanded */}
          <div
            className={cn(
              "absolute top-0 h-10 border border-transparent",
              "transition-all duration-150 ease-out",
              isExpanded ? "left-0 right-0" : "left-0 w-10",
              "group-hover:bg-accent"
            )}
          />

          {/* Icon block: fixed 40×40, anchored to inner left edge */}
          <div className="absolute inset-y-0 left-0 w-10 h-10 flex items-center justify-center pointer-events-none">
            <Suspense fallback={
              <Avatar className="w-6 h-6">
                <div className="flex h-full w-full items-center justify-center bg-accent">
                  <Icons.UserRound className="text-tertiary" />
                </div>
              </Avatar>
            }>
              <BrandAvatar />
            </Suspense>
          </div>

          {/* Label: always mounted, fades in on expand. Starts at 48px (40 icon + 8 gap). */}
          <div
            className={cn(
              "absolute inset-y-0 left-10 right-6 flex items-center pointer-events-none",
              "transition-opacity duration-150 ease-out",
              isExpanded ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="text-p !font-medium truncate text-secondary transition-colors group-hover:text-primary">
              {activeBrand?.name ?? "No Brand"}
            </span>
          </div>

          {/* Chevron: always mounted, same timing as label, synced fade with slight slide. */}
          <div
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none",
              "transition-all duration-150 ease-out",
              isExpanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
            )}
          >
            <Icons.ChevronsUpDown className="h-4 w-4 text-secondary transition-colors group-hover:text-primary" />
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[240px]"
        sideOffset={8}     // match the 8px grid of the sidebar padding
        align="start"
      >
        <DropdownMenuLabel>
          <span className="!text-small text-foreground">Select Brand</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {brands.map((brand: Brand) => (
            <DropdownMenuItem
              key={brand.id}
              className={cn(
                "cursor-pointer",
                currentUser?.brand_id === brand.id && "bg-accent"
              )}
              onClick={() => handleBrandSelect(brand.id)}
            >
                <span className="text-p truncate">{brand.name}</span>
                {currentUser?.brand_id === brand.id && (
                  <Icons.Check className="ml-auto h-4 w-4 flex-shrink-0" />
                )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" onClick={handleCreateBrand}>
            <div className="flex items-center gap-2">
              <span className="text-p">Create Brand</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}