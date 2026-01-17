"use client";

import { useDebounce } from "@/hooks/use-debounce";
import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import { useEffect, useMemo, useRef, useState } from "react";

interface Brand {
  id: string;
  name: string;
  slug?: string | null;
}

/**
 * Validates a slug format:
 * - Lowercase letters, numbers, and dashes only
 * - No leading/trailing dashes
 * - 2-50 characters
 */
function isValidSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 50) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function SetSlug() {
  const { data: brandsData } = useUserBrandsQuery();
  const { data: user } = useUserQuery();
  const updateBrand = useBrandUpdateMutation();
  const trpc = useTRPC();

  const brands = (brandsData as Brand[] | undefined) ?? [];
  const activeBrand = brands.find(
    (b: Brand) => b.id === (user as CurrentUser | null | undefined)?.brand_id,
  );

  const initialSlugRef = useRef<string>("");
  const [slug, setSlug] = useState<string>("");

  useEffect(() => {
    const initial = activeBrand?.slug ?? "";
    initialSlugRef.current = initial;
    setSlug(initial);
  }, [activeBrand?.slug]);

  const trimmed = slug.trim().toLowerCase();
  const isDirty =
    trimmed !== (initialSlugRef.current ?? "").trim().toLowerCase();
  const isEmpty = trimmed.length === 0;
  const isFormatValid = isEmpty || isValidSlug(trimmed);
  const isSaving = updateBrand.status === "pending";

  // Debounce the slug for availability check (500ms delay)
  const debouncedSlug = useDebounce(trimmed, 500);

  // Check slug availability using tRPC query
  const slugCheckQuery = useQuery({
    ...trpc.brand.checkSlug.queryOptions({ slug: debouncedSlug }),
    enabled: Boolean(
      debouncedSlug &&
        isFormatValid &&
        isDirty &&
        debouncedSlug.length >= 2 &&
        activeBrand?.id,
    ),
    staleTime: 10000, // Cache for 10 seconds
  });

  // Determine if we're currently checking availability
  const isChecking =
    slugCheckQuery.isLoading ||
    (trimmed !== debouncedSlug && isDirty && !isEmpty && isFormatValid);

  // Slug is available if the check returned true or if it's the same as initial
  const isAvailable = slugCheckQuery.data?.available ?? null;
  const isTaken = isAvailable === false;

  // Only show availability status when we have a valid, dirty slug that has been checked
  const showAvailabilityStatus =
    !isEmpty &&
    isFormatValid &&
    isDirty &&
    debouncedSlug === trimmed &&
    !isChecking;

  function handleSlugChange(value: string) {
    // Auto-format: lowercase, replace spaces with dashes
    const formatted = value.toLowerCase().replace(/\s+/g, "-");
    setSlug(formatted);
  }

  function handleSave() {
    if (!isDirty || isSaving || !activeBrand) return;

    if (!isEmpty && !isValidSlug(trimmed)) {
      toast.error(
        "Slug can only contain lowercase letters, numbers, and dashes",
      );
      return;
    }

    if (isTaken) {
      toast.error("This slug is already taken by another brand");
      return;
    }

    updateBrand.mutate(
      { id: activeBrand.id, slug: trimmed || null },
      {
        onSuccess: () => {
          initialSlugRef.current = trimmed;
          setSlug(trimmed);
          toast.success("Changes saved successfully");
        },
        onError: (err) => {
          // Check for structured error code first (if available)
          const errorCode = (err as { code?: string } | null)?.code;
          if (errorCode === "SLUG_TAKEN") {
            toast.error("This slug is already taken by another brand");
            return;
          }

          // Fallback to message checking if no code is available
          const message = err?.message ?? "";
          if (
            message.includes("slug is already taken") ||
            message.includes("already taken")
          ) {
            toast.error("This slug is already taken by another brand");
          } else {
            toast.error(message || "Failed to save");
          }
        },
      },
    );
  }

  // Disable save button if: not dirty, invalid format, currently saving, checking, or slug is taken
  const isSaveDisabled =
    !isDirty ||
    (!isEmpty && !isFormatValid) ||
    isSaving ||
    isChecking ||
    isTaken;

  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Slug</h6>
          <p className="text-secondary">
            Enter your product passport URL slug on the right.
          </p>
        </div>
        <div className="relative">
          <Input
            placeholder="your-brand-slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className={cn(
              "w-[250px] pr-10",
              isTaken &&
                showAvailabilityStatus &&
                "border-destructive focus-visible:ring-destructive",
            )}
          />
          {/* Loading spinner - absolutely positioned */}
          {isChecking && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Icons.Loader2 className="h-4 w-4 animate-spin text-secondary" />
            </div>
          )}
          {/* Error message - absolutely positioned below input */}
          {showAvailabilityStatus && isTaken && (
            <p className="absolute top-full right-0 mt-1 type-small text-destructive whitespace-nowrap">
              This slug is already taken
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-row justify-end border-x border-b p-6">
        <Button
          variant="default"
          disabled={isSaveDisabled}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

export { SetSlug };
