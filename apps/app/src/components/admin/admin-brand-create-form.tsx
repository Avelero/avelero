"use client";

import { CountrySelect } from "@/components/select/country-select";
import { useImageUpload } from "@/hooks/use-upload";
import { useTRPC } from "@/trpc/client";
import { sanitizeFilename, validateImageFile } from "@/utils/upload";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SmartAvatar } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { toast } from "@v1/ui/sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMemo, useState } from "react";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(2, "Brand name is required"),
  country_code: z.string().trim().length(2).optional(),
});

const IMAGE_CONFIG = {
  maxBytes: 4 * 1024 * 1024,
  allowedMime: ["image/jpeg", "image/jpg", "image/png"] as const,
};

export function AdminBrandCreateForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { uploadImage } = useImageUpload();

  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation(
    trpc.admin.brands.create.mutationOptions({
      onError: (mutationError) => {
        setError(mutationError.message || "Failed to create brand");
      },
    }),
  );

  const updateBrandMutation = useMutation(trpc.brand.update.mutationOptions());

  const isSubmitting = createMutation.isPending || updateBrandMutation.isPending;

  const logoLabel = useMemo(() => {
    if (!selectedLogoFile) return "Upload logo";
    return selectedLogoFile.name.length > 24
      ? `${selectedLogoFile.name.slice(0, 24)}...`
      : selectedLogoFile.name;
  }, [selectedLogoFile]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  function onSelectLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, IMAGE_CONFIG);
    if (!validation.valid) {
      setError(validation.error);
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedLogoFile(file);
    setLogoPreviewUrl(previewUrl);
    setError(null);
    event.target.value = "";
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = schema.safeParse({
      name,
      country_code: countryCode,
    });

    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid form values");
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        name: parsed.data.name,
        country_code: parsed.data.country_code ? parsed.data.country_code : null,
      });

      if (selectedLogoFile) {
        const fileName = sanitizeFilename(selectedLogoFile.name.toLowerCase());
        const path = [created.brand_id, fileName];

        const uploaded = await uploadImage({
          file: selectedLogoFile,
          bucket: "brand-avatars",
          path,
          isPublic: false,
          validation: IMAGE_CONFIG,
        });

        await updateBrandMutation.mutateAsync({
          id: created.brand_id,
          logo_url: uploaded.displayUrl,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: trpc.admin.brands.list.queryKey(),
      });

      toast.success("Brand created successfully");
      router.push(`/admin/brands/${created.brand_id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to create brand";
      setError(message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[360px] space-y-6">
      <div className="text-center space-y-2">
        <h6 className="text-foreground">Create brand</h6>
        <p className="text-secondary">
          Name your brand, add a logo, and select the country where it operates.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex justify-center">
          <label
            htmlFor="admin-brand-logo-upload"
            className="flex flex-col items-center gap-2 cursor-pointer"
          >
            <SmartAvatar
              size={72}
              name={name || "Brand"}
              src={logoPreviewUrl}
              color={null}
            />
            <span className="type-small text-secondary">{logoLabel}</span>
          </label>
          <input
            id="admin-brand-logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={onSelectLogo}
          />
        </div>

        <div className="space-y-1.5 w-full">
          <Label htmlFor="admin-brand-name">Brand name</Label>
          <Input
            id="admin-brand-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="Avelero Apparel"
            error={Boolean(error)}
          />
        </div>

        <CountrySelect
          id="admin-brand-country"
          label="Country"
          placeholder="Select country"
          value={countryCode}
          onChange={(code) => setCountryCode(code)}
        />

        {error ? (
          <p className="type-small text-destructive text-center">{error}</p>
        ) : null}

        <div className="space-y-2">
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
          <Button asChild className="w-full" type="button" variant="outline">
            <Link href="/admin" prefetch>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
