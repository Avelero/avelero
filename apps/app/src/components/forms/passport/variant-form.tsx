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

import { BasicInfoSection } from "@/components/forms/passport/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/forms/passport/blocks/environment-block";
import { JourneySection } from "@/components/forms/passport/blocks/journey-block";
import { MaterialsSection } from "@/components/forms/passport/blocks/materials-block";
import { VariantFormScaffold } from "@/components/forms/passport/scaffolds/variant-scaffold";
import { VariantsOverview } from "@/components/forms/passport/sidebars/variants-overview";
import {
  usePassportFormContext,
  useRegisterForm,
} from "@/contexts/passport-form-context";
import { useVariantForm } from "@/hooks/use-variant-form";
import { useTRPC } from "@/trpc/client";
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";
import * as React from "react";

interface VariantFormProps {
  mode: "create" | "edit";
  productHandle: string;
  variantUpid?: string; // Optional for create mode
}

function VariantFormInner({ mode, productHandle, variantUpid }: VariantFormProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setIsSubmitting, setHasUnsavedChanges } = usePassportFormContext();
  const isCreateMode = mode === "create";

  // Register form with context
  useRegisterForm({
    type: "variant",
    productHandle,
    variantUpid: variantUpid ?? "new",
  });

  // Scroll to top when variant changes
  // Note: The scrollable container is not window, but the div with overflow-y-auto in the layout
  React.useEffect(() => {
    const scrollContainer = document.getElementById(
      "passport-form-scroll-container",
    );
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    }
  }, [variantUpid]);

  // Fetch the variant override data - only in edit mode
  const { data: variantData } = useQuery({
    ...trpc.products.variantOverrides.get.queryOptions({
      productHandle,
      variantUpid: variantUpid ?? "",
    }),
    enabled: !isCreateMode && !!variantUpid,
  });

  // Fetch product data for sidebar and defaults (use suspense - this doesn't change)
  const { data: productData } = useSuspenseQuery(
    trpc.products.get.queryOptions({
      handle: productHandle,
      includeVariants: true,
      includeAttributes: true,
    }),
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

  // Prefetch variant data on hover
  const prefetchVariant = React.useCallback(
    (targetUpid: string) => {
      if (targetUpid === variantUpid) return; // Don't prefetch current
      queryClient.prefetchQuery(
        trpc.products.variantOverrides.get.queryOptions({
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
    setIsSubmitting(isSubmitting);
  }, [isSubmitting, setIsSubmitting]);

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

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await submit();
    } catch (err) {
      console.error("Form submission failed:", err);
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
            productStatus={productStatus}
            variants={variants}
            selectedUpid={isCreateMode ? "" : (variantUpid ?? "")}
            onVariantHover={prefetchVariant}
          />
        }
        content={
          isCreateMode ? (
            <>
              {/* Attributes Selection Block (Create mode only) */}
              <div className="border border-border bg-background p-6">
                <h3 className="type-h5 text-primary mb-4">Attributes</h3>
                <p className="type-small text-secondary">
                  Select the attribute values for this new variant.
                  The variant creation feature is coming soon.
                </p>
                {/* TODO: Add AttributesSelectBlock component here */}
              </div>
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
