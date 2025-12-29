"use client";

/**
 * VariantForm
 *
 * Main form component for creating and editing variants.
 * Supports two modes:
 * - create: Shows Attributes block for selecting attribute combination
 * - edit: Shows override blocks (BasicInfo, Environment, Materials, Journey)
 *
 * Uses a flipped layout with narrow sidebar on LEFT and wide content on RIGHT.
 * Reuses existing block components from the passport form.
 *
 * Uses useQuery (not useSuspenseQuery) for variant data to avoid
 * triggering suspense boundary when navigating between variants.
 */

import {
  AttributesSelectBlock,
  buildExistingCombinations,
  extractDimensionsFromVariants,
  isSelectionDuplicate,
} from "@/components/forms/passport/blocks/attributes-select-block";
import { BasicInfoSection } from "@/components/forms/passport/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/forms/passport/blocks/environment-block";
import { JourneySection } from "@/components/forms/passport/blocks/journey-block";
import { MaterialsSection } from "@/components/forms/passport/blocks/materials-block";
import { VariantsOverview } from "@/components/forms/passport/sidebars/variants-overview";
import {
  usePassportFormContext,
  useRegisterForm,
} from "@/contexts/passport-form-context";
import { useVariantForm } from "@/hooks/use-variant-form";
import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

// ============================================================================
// Scaffold Component (embedded)
// ============================================================================

function VariantFormScaffold({
  header,
  sidebar,
  content,
  className,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-[924px]", className)}>
      {header}
      <div className="flex flex-row gap-6">
        {/* Narrow sidebar on LEFT */}
        <div className="flex flex-col gap-6 w-full max-w-[300px] shrink-0">
          {sidebar}
        </div>
        {/* Wide content on RIGHT */}
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
          {content}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

interface VariantFormProps {
  mode: "create" | "edit";
  productHandle: string;
  variantUpid?: string; // Optional for create mode
}

function VariantFormInner({ mode, productHandle, variantUpid }: VariantFormProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setIsSubmitting, setHasUnsavedChanges } = usePassportFormContext();
  const isCreateMode = mode === "create";

  // State for create mode selections
  const [selectedAttributes, setSelectedAttributes] = React.useState<Record<string, string>>({});

  // Track if we're actively creating a variant (to suppress duplicate warning during submission)
  const [isCreatingVariant, setIsCreatingVariant] = React.useState(false);

  // Reset form state when entering create mode (fixes cache issue on navigation)
  const createModeKey = isCreateMode ? `${productHandle}-create` : null;
  React.useEffect(() => {
    if (isCreateMode) {
      setSelectedAttributes({});
      setIsCreatingVariant(false);
    }
  }, [createModeKey, isCreateMode]);

  // Register form with context
  useRegisterForm({
    type: "variant",
    productHandle,
    variantUpid: variantUpid ?? "new",
  });

  // Scroll to top when variant changes
  React.useEffect(() => {
    const scrollContainer = document.getElementById(
      "passport-form-scroll-container",
    );
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    }
  }, [variantUpid]);

  // Fetch the variant override data - only in edit mode
  // Form pages should ALWAYS fetch fresh data on mount
  const { data: variantData } = useQuery({
    ...trpc.products.variants.getOverrides.queryOptions({
      productHandle,
      variantUpid: variantUpid ?? "",
    }),
    enabled: !isCreateMode && !!variantUpid,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch product data for sidebar and defaults
  // Form pages should ALWAYS fetch fresh data on mount
  const { data: productData } = useSuspenseQuery({
    ...trpc.products.get.queryOptions({
      handle: productHandle,
      includeVariants: true,
      includeAttributes: true,
    }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Create variant mutation
  const createVariantMutation = useMutation(
    trpc.products.variants.create.mutationOptions()
  );

  // Create attribute value mutation (for resolving pending taxonomy values)
  const createAttributeValueMutation = useMutation(
    trpc.catalog.attributeValues.create.mutationOptions()
  );

  /**
   * Resolves pending taxonomy values (tax:-prefixed IDs) to real brand attribute value IDs.
   * For each dimension, if the selected value is a pending taxonomy value, creates the
   * brand attribute value first and returns the real ID.
   */
  const resolvePendingAttributeValues = React.useCallback(
    async (selections: Record<string, string>): Promise<string[]> => {
      // Get existing brand values from cache for quick lookup
      const brandCatalogQuery = queryClient.getQueryData(
        trpc.composite.catalogContent.queryKey()
      ) as any;
      const existingBrandValues: any[] = [
        ...(brandCatalogQuery?.brandCatalog?.attributeValues ?? []),
      ];
      const taxValues = brandCatalogQuery?.taxonomy?.values ?? [];

      const resolvedIds: string[] = [];

      for (const [attributeId, valueId] of Object.entries(selections)) {
        // Check if this is a pending taxonomy value (tax:-prefixed)
        if (valueId.startsWith("tax:")) {
          const taxonomyValueId = valueId.slice(4);

          // Check if a brand value already exists for this taxonomy value
          const existingByTaxonomy = existingBrandValues.find(
            (v: any) =>
              v.attributeId === attributeId && v.taxonomyValueId === taxonomyValueId
          );

          if (existingByTaxonomy) {
            resolvedIds.push(existingByTaxonomy.id);
          } else {
            // Find the taxonomy value to get its name
            const taxValue = taxValues.find((v: any) => v.id === taxonomyValueId);
            const name = taxValue?.name ?? taxonomyValueId;

            // Create the brand attribute value
            const result = await createAttributeValueMutation.mutateAsync({
              attribute_id: attributeId,
              name,
              taxonomy_value_id: taxonomyValueId,
            });

            if (!result?.data?.id) {
              throw new Error("Failed to create attribute value");
            }

            resolvedIds.push(result.data.id);
            // Add to existing list for subsequent lookups in this batch
            existingBrandValues.push(result.data);
          }
        } else {
          // Already a real brand value ID
          resolvedIds.push(valueId);
        }
      }

      // Invalidate catalog cache if we created any new values
      if (resolvedIds.some((id, idx) => {
        const originalId = Object.values(selections)[idx];
        return originalId?.startsWith("tax:");
      })) {
        queryClient.invalidateQueries({
          queryKey: trpc.composite.catalogContent.queryKey(),
        });
      }

      return resolvedIds;
    },
    [queryClient, trpc, createAttributeValueMutation]
  );

  // Build variants list for sidebar with prefetch capability
  const variants = React.useMemo(() => {
    if (!productData?.variants) return [];

    return productData.variants
      .map((v) => {
        // Build attribute label from variant attributes
        const attrLabel =
          v.attributes && v.attributes.length > 0
            ? v.attributes.map((a) => a.value_name).join(" / ")
            : v.sku || v.barcode || `Variant ${v.upid?.slice(0, 6) ?? ""}`;

        return {
          upid: v.upid ?? "",
          attributeLabel: attrLabel,
          hasOverrides: v.hasOverrides ?? false,
        };
      })
      .filter((v) => v.upid); // Only variants with UPIDs
  }, [productData?.variants]);

  // Extract dimensions from existing variants (for create mode)
  const dimensions = React.useMemo(() => {
    if (!productData?.variants) return [];
    return extractDimensionsFromVariants(productData.variants);
  }, [productData?.variants]);

  // Build existing combinations set (for duplicate check)
  const existingCombinations = React.useMemo(() => {
    if (!productData?.variants) return new Set<string>();
    return buildExistingCombinations(productData.variants);
  }, [productData?.variants]);

  // Check if current selection is a duplicate
  const isDuplicate = React.useMemo(() => {
    return isSelectionDuplicate(selectedAttributes, existingCombinations);
  }, [selectedAttributes, existingCombinations]);

  // Check if all dimensions are selected
  const allDimensionsSelected = React.useMemo(() => {
    return dimensions.every((dim) => selectedAttributes[dim.attributeId]);
  }, [dimensions, selectedAttributes]);

  // Prefetch variant data on hover
  const prefetchVariant = React.useCallback(
    (targetUpid: string) => {
      if (targetUpid === variantUpid) return; // Don't prefetch current
      queryClient.prefetchQuery(
        trpc.products.variants.getOverrides.queryOptions({
          productHandle,
          variantUpid: targetUpid,
        }),
      );
    },
    [queryClient, trpc, productHandle, variantUpid],
  );

  // Get safe values
  const productName = productData?.name ?? "Product";
  const productImage = productData?.image_path ?? null;
  const productDescription = productData?.description ?? null;
  const productStatus =
    productData?.status === "published"
      ? ("published" as const)
      : productData?.status === "archived"
        ? ("archived" as const)
        : ("draft" as const);

  // Form hook - only pass initialData when we have it (empty values = no override)
  const {
    state,
    setField,
    updateField,
    validate,
    submit,
    isSubmitting,
    hasUnsavedChanges,
  } = useVariantForm({
    productHandle,
    variantUpid: variantUpid ?? "new",
    // Pass variant data (override values only, not resolved)
    initialData: variantData && !isCreateMode
      ? {
        name: variantData.name,
        description: variantData.description,
        imagePath: variantData.imagePath,
        environment: variantData.environment,
        ecoClaims: variantData.ecoClaims,
        materials: variantData.materials,
        journey: variantData.journey,
      }
      : undefined,
    productDefaults: {
      name: productName,
      description: productDescription,
      imagePath: productImage,
    },
  });

  // Sync with context
  React.useEffect(() => {
    setIsSubmitting(isSubmitting || createVariantMutation.isPending);
  }, [isSubmitting, createVariantMutation.isPending, setIsSubmitting]);

  React.useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  // Eco claims handler
  const handleEcoClaimsChange = React.useCallback<
    React.Dispatch<React.SetStateAction<{ id: string; value: string }[]>>
  >(
    (value) => {
      if (typeof value === "function") {
        updateField("ecoClaims", value);
      } else {
        setField("ecoClaims", value);
      }
    },
    [setField, updateField],
  );

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isCreateMode) {
      // Create mode: create the variant with selected attributes
      if (!allDimensionsSelected) {
        toast.error("Please select a value for each attribute");
        return;
      }

      if (isDuplicate) {
        toast.error("A variant with this attribute combination already exists");
        return;
      }

      // Set creating flag to prevent duplicate warning flash after cache invalidation
      setIsCreatingVariant(true);

      try {
        // Resolve any pending taxonomy values (tax:-prefixed) to real brand value IDs
        const resolvedAttributeValueIds = await resolvePendingAttributeValues(
          selectedAttributes
        );

        const result = await createVariantMutation.mutateAsync({
          productHandle,
          attributeValueIds: resolvedAttributeValueIds,
        });

        // Navigate first, then invalidate in background (prevents flash of duplicate warning)
        toast.success("Variant created successfully");

        if (result.data?.upid) {
          // Navigate immediately
          router.push(`/passports/edit/${productHandle}/variant/${result.data.upid}`);

          // Invalidate queries in background (don't await - navigation takes priority)
          queryClient.invalidateQueries({
            queryKey: trpc.products.get.queryKey({
              handle: productHandle,
              includeVariants: true,
              includeAttributes: true,
            }),
          });
        }
      } catch (err) {
        console.error("Failed to create variant:", err);
        toast.error("Failed to create variant");
        setIsCreatingVariant(false);
      }
    } else {
      // Edit mode: save overrides
      const errors = validate();
      if (Object.keys(errors).length > 0) {
        return;
      }

      try {
        await submit();
      } catch (err) {
        console.error("Form submission failed:", err);
      }
    }
  };

  // Breadcrumb content based on mode
  const breadcrumbLabel = isCreateMode ? "Create variant" : "Variants";

  return (
    <form
      id="variant-form"
      className="flex justify-center w-full"
      onSubmit={handleSubmit}
    >
      <VariantFormScaffold
        header={
          <div className="flex items-center justify-between">
            {/* Breadcrumb: Product Name / Create variant OR Variants */}
            <nav className="flex items-center type-h4" aria-label="Breadcrumb">
              <Link
                href={`/passports/edit/${productHandle}`}
                className="text-secondary hover:text-primary transition-colors duration-150"
              >
                {productName}
              </Link>
              <span className="mx-2 text-tertiary" aria-hidden="true">
                /
              </span>
              <span className="text-primary">{breadcrumbLabel}</span>
            </nav>
          </div>
        }
        sidebar={
          <VariantsOverview
            productHandle={productHandle}
            productName={productName}
            productImage={productImage}
            variants={variants}
            selectedUpid={isCreateMode ? "" : (variantUpid ?? "")}
            onVariantHover={prefetchVariant}
          />
        }
        content={
          isCreateMode ? (
            <>
              {/* Attributes Selection Block (Create mode only) */}
              <AttributesSelectBlock
                dimensions={dimensions}
                existingCombinations={existingCombinations}
                selectedValues={selectedAttributes}
                onSelectionChange={setSelectedAttributes}
                isDuplicate={isDuplicate && !isCreatingVariant}
              />
            </>
          ) : (
            <>
              {/* Disclaimer Banner (Edit mode only) */}
              <div className="border border-border bg-accent-light/50 p-4 flex gap-3">
                <Icons.Info className="h-5 w-5 text-tertiary shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="type-p font-medium text-primary">
                    Variant Overrides
                  </p>
                  <p className="type-small text-secondary">
                    Values entered here override the product defaults for this
                    specific variant. Leave fields empty to inherit values from
                    the product level.
                  </p>
                </div>
              </div>

              {/* Basic Info Block - Not required for variants */}
              <BasicInfoSection
                name={state.name}
                setName={(value) => setField("name", value)}
                description={state.description}
                setDescription={(value) => setField("description", value)}
                imageFile={state.imageFile}
                setImageFile={(file) => {
                  setField("imageFile", file);
                  if (file) setField("existingImageUrl", null);
                }}
                existingImageUrl={state.existingImageUrl}
                nameError={undefined}
                required={false}
              />

              {/* Environment Block */}
              <EnvironmentSection
                carbonKgCo2e={state.carbonKgCo2e}
                setCarbonKgCo2e={(value) => setField("carbonKgCo2e", value)}
                waterLiters={state.waterLiters}
                setWaterLiters={(value) => setField("waterLiters", value)}
                ecoClaims={state.ecoClaims}
                setEcoClaims={handleEcoClaimsChange}
                carbonError={
                  state.hasAttemptedSubmit
                    ? state.validationErrors.carbonKgCo2e
                    : undefined
                }
                waterError={
                  state.hasAttemptedSubmit
                    ? state.validationErrors.waterLiters
                    : undefined
                }
              />

              {/* Materials Block */}
              <MaterialsSection
                materials={state.materials}
                setMaterials={(value) => setField("materials", value)}
                materialsError={
                  state.hasAttemptedSubmit
                    ? state.validationErrors.materials
                    : undefined
                }
              />

              {/* Journey Block */}
              <JourneySection
                journeySteps={state.journeySteps}
                setJourneySteps={(value) => setField("journeySteps", value)}
              />
            </>
          )
        }
      />
    </form>
  );
}

/**
 * EditVariantForm - Wrapper for editing an existing variant
 */
export function EditVariantForm({ productHandle, variantUpid }: { productHandle: string; variantUpid: string }) {
  return <VariantFormInner mode="edit" productHandle={productHandle} variantUpid={variantUpid} />;
}

/**
 * CreateVariantForm - Wrapper for creating a new variant
 */
export function CreateVariantForm({ productHandle }: { productHandle: string }) {
  return <VariantFormInner mode="create" productHandle={productHandle} />;
}

// Legacy export for backward compatibility
export { EditVariantForm as VariantForm, EditVariantForm as VariantEditForm };
