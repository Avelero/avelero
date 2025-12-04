"use client";

import { useBrandUpdateMutation, useUserBrandsQuery } from "@/hooks/use-brand";
import { type CurrentUser, useUserQuery } from "@/hooks/use-user";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import { useEffect, useRef, useState } from "react";

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
  const isDirty = trimmed !== (initialSlugRef.current ?? "").trim().toLowerCase();
  const isEmpty = trimmed.length === 0;
  const isValid = isEmpty || isValidSlug(trimmed);
  const isSaving = updateBrand.status === "pending";

  function handleSlugChange(value: string) {
    // Auto-format: lowercase, replace spaces with dashes
    const formatted = value.toLowerCase().replace(/\s+/g, "-");
    setSlug(formatted);
  }

  function handleSave() {
    if (!isDirty || isSaving || !activeBrand) return;

    if (!isEmpty && !isValidSlug(trimmed)) {
      toast.error("Slug can only contain lowercase letters, numbers, and dashes");
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
          if (message.includes("slug is already taken") || message.includes("already taken")) {
            toast.error("This slug is already taken by another brand");
          } else {
            toast.error(message || "Failed to save");
          }
        },
      },
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-row p-6 border justify-between items-center">
        <div className="flex flex-col gap-2">
          <h6 className="text-foreground">Slug</h6>
          <p className="text-secondary">Enter your product passport URL slug on the right.</p>
        </div>
        <Input
          placeholder="your-brand-slug"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className="max-w-[250px]"
        />
      </div>
      <div className="flex flex-row justify-end border-x border-b p-6">
        <Button
          variant="default"
          disabled={!isDirty || (!isEmpty && !isValid) || isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

export { SetSlug };
