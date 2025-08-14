"use client";

import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { useUserBrandsQuery, useSetActiveBrandMutation } from "@/hooks/use-brand";
import { useUserQuery } from "@/hooks/use-user";
import { useRouter, useParams } from "next/navigation";

interface Brand {
  id: string;
  name: string;
  logo_url?: string | null;
  country_code?: string | null;
}

interface BrandDropdownProps {
  isExpanded: boolean;
}

export function BrandDropdown({ isExpanded }: BrandDropdownProps) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";
  
  const { data: brandsData, isLoading: brandsLoading } = useUserBrandsQuery();
  const { data: user, isLoading: userLoading } = useUserQuery();
  const setActiveBrandMutation = useSetActiveBrandMutation();

  const brands = brandsData?.data ?? [];
  const activeBrand = brands.find(brand => brand.id === user?.brand_id);
  const isLoading = brandsLoading || userLoading;

  const handleBrandSelect = (brandId: string) => {
    if (brandId !== user?.brand_id) {
      setActiveBrandMutation.mutate({ id: brandId });
    }
  };

  const handleCreateBrand = () => {
    router.push(`/${locale}/brands/create`);
  };

  return (
    <div className="w-full p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            className={cn(
              "w-full justify-between h-[40px] transition-all duration-200",
              "bg-background hover:bg-muted border border-border rounded-lg",
              isExpanded ? "px-3" : "px-2"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* Brand Logo/Avatar */}
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                {isLoading ? (
                  <div className="w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <span className="text-xs font-medium text-primary">
                    {activeBrand?.name.charAt(0) ?? "?"}
                  </span>
                )}
              </div>
              
              {/* Brand Name - only show when expanded */}
              {isExpanded && (
                <span className="text-sm font-medium truncate">
                  {isLoading ? "Loading..." : (activeBrand?.name ?? "No Brand")}
                </span>
              )}
            </div>
            
            {/* Chevron - only show when expanded */}
            {isExpanded && (
              <Icons.ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-[240px]" sideOffset={10} align="start">
          <DropdownMenuLabel>
            <span className="text-xs font-medium text-muted-foreground">
              Select Brand
            </span>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            {brands.map((brand) => (
              <DropdownMenuItem
                key={brand.id}
                className={cn(
                  "cursor-pointer",
                  user?.brand_id === brand.id && "bg-muted"
                )}
                onClick={() => handleBrandSelect(brand.id)}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {brand.name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm truncate">{brand.name}</span>
                  {user?.brand_id === brand.id && (
                    <Icons.Check className="ml-auto h-4 w-4 flex-shrink-0" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={handleCreateBrand}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">+</span>
                </div>
                <span className="text-sm">Create Brand</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
