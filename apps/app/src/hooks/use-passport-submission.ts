import { useTRPC } from "@/trpc/client";
import { useUpload } from "@/hooks/use-upload";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Form data shape for passport submission.
 * All metadata fields store IDs, not full objects.
 */
export interface PassportFormData {
  /** Active brand identifier (required for API calls) */
  brandId: string;
  // Basic info
  title: string;
  description?: string;
  imageFile?: File | null;
  
  // Organization
  categoryId?: string | null;
  season?: string | null;
  showcaseBrandId?: string | null; // Operator/manufacturer
  
  // Product-level identifier (article number) - required
  articleNumber: string;
  
  // Variant info
  colorIds?: string[];
  sizeIds?: string[];
  
  // Materials (with percentages)
  materials?: Array<{ materialId: string; percentage: number }>;
  
  // Journey steps
  journeySteps?: Array<{ 
    stepType: string; 
    facilityId: string; 
    sortIndex: number;
  }>;
  
  // Environment
  carbonKgCo2e?: string;
  waterLiters?: string;
  
  // Tags (not yet implemented in API)
  tagIds?: string[];
}

/**
 * Hook for submitting passport creation with full product/variant chain.
 * 
 * Orchestrates the multi-step creation process:
 * 1. Upload image (if provided)
 * 2. Create product
 * 3. Create variant
 * 4. Update product with attributes (materials, journey, environment)
 * 5. Create passport
 * 
 * All metadata (materials, operators, colors, sizes) must be created BEFORE
 * calling this hook. This hook only creates the product/variant/passport.
 * 
 * @returns Submission function and mutation state
 */
export function usePassportSubmission() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const createProductMutation = useMutation(
    trpc.products.create.mutationOptions(),
  );

  const upsertVariantsMutation = useMutation(
    trpc.products.variants.upsert.mutationOptions(),
  );

  const updateProductMutation = useMutation(
    trpc.products.update.mutationOptions(),
  );

  const createPassportMutation = useMutation(
    trpc.passports.create.mutationOptions(),
  );

  const submit = React.useCallback(async (formData: PassportFormData) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const title = formData.title?.trim();
      if (!title) {
        throw new Error("Title is required");
      }

      const articleNumber = formData.articleNumber?.trim();
      if (!articleNumber) {
        throw new Error("Article number is required");
      }

      // Step 1: Upload image if provided
      let primaryImageUrl: string | undefined;
      if (formData.imageFile) {
        try {
          const timestamp = Date.now();
          const sanitizedFileName = formData.imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const result = await uploadFile({
            file: formData.imageFile,
            path: ["products", `${timestamp}-${sanitizedFileName}`],
            bucket: "products",
          });
          primaryImageUrl = result.url;
        } catch (err) {
          throw new Error(`Failed to upload image: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }
      
      // Step 2: Create product
      let productId: string;
      try {
        const productResult = await createProductMutation.mutateAsync({
          brand_id: formData.brandId,
          name: title,
          description: formData.description,
          category_id: formData.categoryId ?? undefined,
          season: formData.season ?? undefined,
          showcase_brand_id: formData.showcaseBrandId ?? undefined,
          primary_image_url: primaryImageUrl,
        });
        const product = productResult?.data;
        const createdProductId = product?.id;
        if (!createdProductId) {
          throw new Error("Product creation returned no ID");
        }
        productId = createdProductId;
      } catch (err) {
        throw new Error(`Failed to create product: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
      
      // Step 3: Create variants (using products.variants.upsert)
      const variantIds: string[] = [];
      try {
        const colorIds: Array<string | null> =
          formData.colorIds && formData.colorIds.length > 0
            ? [...formData.colorIds]
            : [null];
        const sizeIds: Array<string | null> =
          formData.sizeIds && formData.sizeIds.length > 0
            ? [...formData.sizeIds]
            : [null];

        const variantsPayload: Array<{
          upid: string;
          sku: string | null;
          color_id: string | null;
          size_id: string | null;
        }> = [];

        let variantCounter = 0;
        for (const colorId of colorIds) {
          for (const sizeId of sizeIds) {
            variantCounter += 1;
            const upid = `UPID-${productId}-${variantCounter.toString().padStart(3, "0")}`;
            variantsPayload.push({
              upid,
              sku: null,
              color_id: colorId ?? null,
              size_id: sizeId ?? null,
            });
          }
        }

        const variantResult = await upsertVariantsMutation.mutateAsync({
          product_id: productId,
          variants: variantsPayload,
        });

        const variantResults = variantResult?.data ?? [];
        for (const result of variantResults) {
          if (result.status !== "error" && result.variant_id) {
            variantIds.push(result.variant_id);
          }
        }

        if (variantIds.length === 0) {
          throw new Error("Variant creation returned no IDs");
        }
      } catch (err) {
        throw new Error(`Failed to create variant: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
      
      // Step 4: Update product with attributes (materials, journey, environment)
      try {
        const updatePayload: any = {
          id: productId,
        };
        
        // Add materials if provided
        if (formData.materials && formData.materials.length > 0) {
          updatePayload.materials = formData.materials.map(m => ({
            brand_material_id: m.materialId,
            percentage: m.percentage,
          }));
        }
        
        // Add journey steps if provided
        if (formData.journeySteps && formData.journeySteps.length > 0) {
          updatePayload.journeySteps = formData.journeySteps.map(step => ({
            sort_index: step.sortIndex,
            step_type: step.stepType,
            facility_id: step.facilityId,
          }));
        }
        
        // Add environment data if provided
        if (formData.carbonKgCo2e || formData.waterLiters) {
          updatePayload.environment = {
            carbon_kg_co2e: formData.carbonKgCo2e,
            water_liters: formData.waterLiters,
          };
        }
        
        // Only call update if we have attributes to update
        if (Object.keys(updatePayload).length > 1) { // More than just 'id'
          await updateProductMutation.mutateAsync(updatePayload);
        }
      } catch (err) {
        throw new Error(`Failed to update product attributes: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
      
      // Step 5: Create passports for each variant
      const createdPassports: { variantId: string; upid: string }[] = [];
      const passportErrors: Array<{ variantId: string; error: string }> = [];
      try {
        const passportResults = await Promise.all(
          variantIds.map(async (variantId) => {
            try {
              const passportResult = await createPassportMutation.mutateAsync({
                product_id: productId,
                variant_id: variantId,
                status: "unpublished",
              });
              const createdPassportUpid = passportResult?.data?.upid ?? "";
              if (!createdPassportUpid) {
                throw new Error("Passport creation returned no UPID");
              }
              return {
                status: "fulfilled" as const,
                variantId,
                upid: createdPassportUpid,
              };
            } catch (error) {
              return {
                status: "rejected" as const,
                variantId,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown passport creation error",
              };
            }
          }),
        );

        for (const result of passportResults) {
          if (result.status === "fulfilled") {
            createdPassports.push({
              variantId: result.variantId,
              upid: result.upid,
            });
          } else {
            passportErrors.push({
              variantId: result.variantId,
              error: result.error,
            });
          }
        }

        if (createdPassports.length === 0) {
          const firstError = passportErrors[0]?.error ?? "Unknown error";
          throw new Error(`Failed to create passports: ${firstError}`);
        }
      } catch (err) {
        throw new Error(
          `Failed to create passport: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      }
      
      // Success! Invalidate queries and navigate
      void Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: trpc.passports.list.queryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.products.list.queryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.composite.passportFormReferences.queryKey(),
        }),
      ]);
      
      if (passportErrors.length > 0) {
        toast.error(
          `Created ${createdPassports.length} passport(s), but ${passportErrors.length} variant(s) failed.`,
        );
      } else {
        toast.success("Passports created successfully");
      }
      setIsSubmitting(false);
      
      // Navigate to the first created passport detail page
      const targetPassport = createdPassports[0];
      if (targetPassport?.upid) {
        router.push(`/passports/${targetPassport.upid}`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create passport";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
      throw err; // Re-throw so caller can handle if needed
    }
  }, [
    createProductMutation,
    upsertVariantsMutation,
    updateProductMutation,
    createPassportMutation,
    queryClient,
    router,
    uploadFile,
  ]);

  return {
    submit,
    isSubmitting,
    error,
  };
}

