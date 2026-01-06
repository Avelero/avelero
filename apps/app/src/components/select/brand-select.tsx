"use client";

import {
    useSetActiveBrandMutation,
    useUserBrandsQuerySuspense,
} from "@/hooks/use-brand";
import { type CurrentUser, useUserQuerySuspense } from "@/hooks/use-user";
import { SmartAvatar } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
    Select,
    SelectAction,
    SelectContent,
    SelectFooter,
    SelectGroup,
    SelectHeader,
    SelectItem,
    SelectList,
    SelectTrigger,
} from "@v1/ui/select";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { SignedAvatar } from "../signed-avatar";

interface Brand {
    id: string;
    name: string;
    logo_url?: string | null;
    role: "owner" | "member" | null;
    canLeave?: boolean;
    email?: string | null;
    country_code?: string | null;
}

interface BrandSelectProps {
    isExpanded: boolean;
    onPopupChange: (isOpen: boolean) => void;
}

function BrandSelectContent({ isExpanded, onPopupChange }: BrandSelectProps) {
    const { data: brandsData } = useUserBrandsQuerySuspense();
    const { data: user } = useUserQuerySuspense();
    const setActiveBrandMutation = useSetActiveBrandMutation();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const brands: Brand[] = (brandsData as Brand[] | undefined) ?? [];
    const currentUser = user as CurrentUser | null | undefined;
    const activeBrand = brands.find((b: Brand) => b.id === currentUser?.brand_id);
    const isSwitching = setActiveBrandMutation.isPending;

    const handleBrandSelect = (brandId: string) => {
        if (brandId !== currentUser?.brand_id && !isSwitching) {
            setActiveBrandMutation.mutate({ brand_id: brandId });
            setOpen(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        onPopupChange(isOpen);
    };

    return (
        <Select open={open} onOpenChange={handleOpenChange}>
            <SelectTrigger asChild disabled={isSwitching}>
                {/* Button is the sole interactive host. All visuals are inside. */}
                <Button
                    variant="ghost"
                    disabled={isSwitching}
                    className={cn(
                        "relative group h-10 w-full p-0 bg-transparent hover:bg-transparent data-[state=open]:bg-transparent",
                        "justify-start overflow-hidden",
                        isSwitching && "opacity-50",
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
                        <SignedAvatar
                            bucket="brand-avatars"
                            id={activeBrand?.id ?? ""}
                            size={24}
                            name={activeBrand?.name}
                            url={activeBrand?.logo_url ?? undefined}
                        />
                    </div>

                    {/* Label: always mounted, fades in on expand. Starts at 48px (40 icon + 8 gap). */}
                    <div
                        className={cn(
                            "absolute inset-y-0 left-10 right-6 flex items-center pointer-events-none",
                            "transition-opacity duration-150 ease-out",
                            isExpanded ? "opacity-100" : "opacity-0",
                        )}
                    >
                        <span className="type-p !font-medium truncate text-secondary transition-colors group-hover:text-primary group-data-[state=open]:text-primary">
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
                        <Icons.ChevronsUpDown className="h-4 w-4 text-secondary transition-colors group-hover:text-primary group-data-[state=open]:text-primary" />
                    </div>
                </Button>
            </SelectTrigger>

            <SelectContent className="w-[240px]" sideOffset={8} shouldFilter={false} defaultValue={activeBrand?.id}>
                <SelectHeader className="border-b-0">{currentUser?.email}</SelectHeader>

                <SelectList>
                    <SelectGroup>
                        {brands.map((brand: Brand) => (
                            <SelectItem
                                key={brand.id}
                                value={brand.id}
                                disabled={isSwitching}
                                onSelect={() => handleBrandSelect(brand.id)}
                                className={cn(
                                    isSwitching && "opacity-50",
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <SignedAvatar
                                        bucket="brand-avatars"
                                        id={brand.id}
                                        size={20}
                                        name={brand.name}
                                        url={brand.logo_url ?? undefined}
                                    />
                                    <span className="type-p truncate">{brand.name}</span>
                                </div>
                                {currentUser?.brand_id === brand.id && (
                                    <Icons.Check className="h-4 w-4 flex-shrink-0" />
                                )}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectList>

                <SelectFooter>
                    <SelectAction
                        disabled={isSwitching}
                        onSelect={() => router.push("/create-brand")}
                    >
                        <div className="flex items-center gap-2">
                            <Icons.Plus className="h-3.5 w-3.5" />
                            <span>Create Brand</span>
                        </div>
                    </SelectAction>
                </SelectFooter>
            </SelectContent>
        </Select>
    );
}

function BrandSelectSkeleton() {
    return (
        <div className="relative h-10 w-full rounded-full border border-transparent">
            <div className="absolute inset-y-0 left-0 w-10 h-10 flex items-center justify-center">
                <SmartAvatar size={24} loading />
            </div>
        </div>
    );
}

export function BrandSelect(props: BrandSelectProps) {
    return (
        <Suspense fallback={<BrandSelectSkeleton />}>
            <BrandSelectContent {...props} />
        </Suspense>
    );
}

// Re-export with old name for backwards compatibility during migration
export { BrandSelect as BrandDropdown };
