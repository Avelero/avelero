"use client";

/**
 * ProductForm
 *
 * Main form component for creating and editing products (passports).
 * Uses the new consolidated folder structure.
 */

import { BasicInfoSection } from "@/components/forms/passport/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/forms/passport/blocks/environment-block";
import { JourneySection } from "@/components/forms/passport/blocks/journey-block";
import { MaterialsSection } from "@/components/forms/passport/blocks/materials-block";
import { OrganizationSection } from "@/components/forms/passport/blocks/organization-block";
import { VariantSection } from "@/components/forms/passport/blocks/variant-block";
import { IdentifiersSidebar } from "@/components/forms/passport/sidebars/identifiers-sidebar";
import { StatusSidebar } from "@/components/forms/passport/sidebars/status-sidebar";
import {
  VariantDeletionModal,
  type VariantToDelete,
} from "@/components/modals/variant-deletion-modal";
import {
  usePassportFormContext,
  useRegisterForm,
} from "@/contexts/passport-form-context";
import { getFirstInvalidField, isFormValid } from "@/hooks/use-form-validation";
import { usePassportForm } from "@/hooks/use-passport-form";
import type { PassportFormValidationErrors } from "@/hooks/use-passport-form";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { cn } from "@v1/ui/cn";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

// ============================================================================
// Scaffold Component (embedded)
// ============================================================================

function ProductFormScaffold({
  title,
  left,
  right,
  actions,
  className,
  leftClassName,
  rightClassName,
}: {
  title: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-[924px]", className)}>
      <div className="flex items-center justify-between">
        <p className="type-h4 text-primary">{title}</p>
        {actions}
      </div>
      <div className="flex flex-row gap-6">
        <div
          className={cn(
            "flex flex-col gap-6 w-full max-w-[600px]",
            leftClassName,
          )}
        >
          {left}
        </div>
        <div
          className={cn(
            "flex flex-col gap-6 w-full max-w-[300px]",
            rightClassName,
          )}
        >
          {right}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ProductFormProps {
  mode: "create" | "edit";
  productHandle?: string;
  initialData?: unknown;
}

function ProductFormInner({
  mode,
  productHandle,
  initialData,
}: ProductFormProps) {
  const { data: user } = useUserQuery();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    setIsSubmitting,
    setHasUnsavedChanges,
    requestNavigation,
    formResetCallbackRef,
    setProductId,
    publishingStatus,
    setPublishingStatus,
  } = usePassportFormContext();
  const isEditMode = mode === "edit";

  // Register form with context
  useRegisterForm({
    type: mode,
    productHandle,
  });

  const {
    state,
    setField,
    updateField,
    clearValidationError,
    validate,
    submit,
    isSubmitting,
    hasUnsavedChanges,
    revertToSaved,
    savedVariantsMap,
    productHandle: savedProductHandle,
    productId,
    dbPublishingStatus,
    getVariantsToDelete,
  } = usePassportForm({ mode, productHandle, initialData });

  // Variant deletion warning modal state
  const [variantDeletionModalOpen, setVariantDeletionModalOpen] =
    React.useState(false);
  const [pendingVariantDeletions, setPendingVariantDeletions] = React.useState<
    VariantToDelete[]
  >([]);
  const pendingSubmitRef = React.useRef<(() => Promise<void>) | null>(null);

  // Sync productId and publishing state with context when they change
  React.useEffect(() => {
    setProductId(productId);
    setPublishingStatus(dbPublishingStatus);
  }, [productId, setProductId, dbPublishingStatus, setPublishingStatus]);

  // Clear errors when fields change (after first submit attempt)
  React.useEffect(() => {
    if (state.hasAttemptedSubmit && state.name && state.validationErrors.name) {
      clearValidationError("name");
    }
  }, [
    state.name,
    state.hasAttemptedSubmit,
    state.validationErrors.name,
    clearValidationError,
  ]);

  React.useEffect(() => {
    if (
      state.hasAttemptedSubmit &&
      state.productHandle &&
      state.validationErrors.productHandle
    ) {
      clearValidationError("productHandle");
    }
  }, [
    state.productHandle,
    state.hasAttemptedSubmit,
    state.validationErrors.productHandle,
    clearValidationError,
  ]);

  React.useEffect(() => {
    if (
      state.hasAttemptedSubmit &&
      state.materialData.length > 0 &&
      state.validationErrors.materials
    ) {
      const errors = validate();
      if (!errors.materials) {
        clearValidationError("materials");
      }
    }
  }, [
    state.materialData,
    state.hasAttemptedSubmit,
    state.validationErrors.materials,
    validate,
    clearValidationError,
  ]);

  React.useEffect(() => {
    if (
      state.hasAttemptedSubmit &&
      state.carbonKgCo2e &&
      state.validationErrors.carbonKgCo2e
    ) {
      const carbonValue = Number.parseFloat(state.carbonKgCo2e);
      if (!Number.isNaN(carbonValue) && carbonValue >= 0) {
        clearValidationError("carbonKgCo2e");
      }
    }
  }, [
    state.carbonKgCo2e,
    state.hasAttemptedSubmit,
    state.validationErrors.carbonKgCo2e,
    clearValidationError,
  ]);

  React.useEffect(() => {
    if (
      state.hasAttemptedSubmit &&
      state.waterLiters &&
      state.validationErrors.waterLiters
    ) {
      const waterValue = Number.parseFloat(state.waterLiters);
      if (!Number.isNaN(waterValue) && waterValue >= 0) {
        clearValidationError("waterLiters");
      }
    }
  }, [
    state.waterLiters,
    state.hasAttemptedSubmit,
    state.validationErrors.waterLiters,
    clearValidationError,
  ]);

  // Sync with context
  React.useEffect(() => {
    setIsSubmitting(isSubmitting);
  }, [isSubmitting, setIsSubmitting]);

  // Sync hasUnsavedChanges with context for both create and edit modes
  // This ensures the unsaved changes modal shows when users have entered data
  React.useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  // Register revert callback with context so discard handler can revert to saved state
  // We use revertToSaved instead of resetForm to restore form to last fetched data
  // rather than resetting to empty initial values
  React.useEffect(() => {
    formResetCallbackRef.current = revertToSaved;
    return () => {
      formResetCallbackRef.current = null;
    };
  }, [revertToSaved, formResetCallbackRef]);

  // Refs for focusing invalid fields
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const productHandleInputRef = React.useRef<HTMLInputElement>(null);
  const materialsSectionRef = React.useRef<HTMLDivElement>(null);

  // Perform the actual form submission
  const executeSubmit = React.useCallback(async () => {
    if (!user?.brand_id) return;
    try {
      await submit(user.brand_id);
    } catch (err) {
      console.error("Form submission failed:", err);
    }
  }, [user?.brand_id, submit]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user?.brand_id) return;

    const errors = validate();
    const missingRequired = !state.name.trim() || !state.productHandle.trim();
    const materialsErrorMessage = errors.materials;

    if (!isFormValid(errors)) {
      if (missingRequired) {
        toast.error("Please fill in the required fields");
      } else if (materialsErrorMessage) {
        toast.error(materialsErrorMessage);
      } else {
        toast.error("Please fix the errors in the form before submitting");
      }

      const fieldOrder: Array<keyof PassportFormValidationErrors> = [
        "name",
        "productHandle",
        "materials",
        "carbonKgCo2e",
        "waterLiters",
      ];
      const firstInvalidField = getFirstInvalidField(errors, fieldOrder);
      if (firstInvalidField === "name") {
        nameInputRef.current?.focus();
        nameInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (firstInvalidField === "productHandle") {
        productHandleInputRef.current?.focus();
        productHandleInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else if (firstInvalidField === "materials") {
        materialsSectionRef.current?.focus();
        materialsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }

      return;
    }

    // Check for variant deletions in edit mode
    if (isEditMode) {
      const variantsToDelete = getVariantsToDelete();
      if (variantsToDelete.length > 0) {
        // Show the deletion warning modal
        setPendingVariantDeletions(variantsToDelete);
        pendingSubmitRef.current = executeSubmit;
        setVariantDeletionModalOpen(true);
        return;
      }
    }

    await executeSubmit();
  };

  // Handle variant deletion confirmation
  const handleConfirmVariantDeletion = React.useCallback(async () => {
    setVariantDeletionModalOpen(false);
    setPendingVariantDeletions([]);
    if (pendingSubmitRef.current) {
      await pendingSubmitRef.current();
      pendingSubmitRef.current = null;
    }
  }, []);

  // Handle variant deletion cancellation
  const handleCancelVariantDeletion = React.useCallback(() => {
    setVariantDeletionModalOpen(false);
    setPendingVariantDeletions([]);
    pendingSubmitRef.current = null;
  }, []);

  return (
    <form
      id="passport-form"
      className="flex justify-center w-full"
      onSubmit={handleSubmit}
    >
      <ProductFormScaffold
        title={
          mode === "create" ? "Create passport" : state.name || "Edit passport"
        }
        left={
          <>
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
              nameError={
                state.hasAttemptedSubmit
                  ? state.validationErrors.name
                  : undefined
              }
              nameInputRef={nameInputRef}
              productHandle={state.productHandle}
              setProductHandle={(value) => setField("productHandle", value)}
              required={true}
            />
            <OrganizationSection
              categoryId={state.categoryId}
              setCategoryId={(value) => setField("categoryId", value)}
              seasonId={state.seasonId}
              setSeasonId={(value) => setField("seasonId", value)}
              tagIds={state.tagIds}
              setTagIds={(value) => setField("tagIds", value)}
            />
            <VariantSection
              dimensions={state.variantDimensions}
              setDimensions={(value) => {
                if (typeof value === "function") {
                  updateField("variantDimensions", value);
                } else {
                  setField("variantDimensions", value);
                }
              }}
              variantMetadata={state.variantMetadata}
              setVariantMetadata={(value) => {
                if (typeof value === "function") {
                  updateField("variantMetadata", value);
                } else {
                  setField("variantMetadata", value);
                }
              }}
              explicitVariants={state.explicitVariants}
              setExplicitVariants={(value) => {
                if (typeof value === "function") {
                  updateField("explicitVariants", value);
                } else {
                  setField("explicitVariants", value);
                }
              }}
              enabledVariantKeys={state.enabledVariantKeys}
              setEnabledVariantKeys={(value) => {
                if (typeof value === "function") {
                  updateField("enabledVariantKeys", value);
                } else {
                  setField("enabledVariantKeys", value);
                }
              }}
              isEditMode={isEditMode}
              productHandle={savedProductHandle ?? undefined}
              savedVariants={savedVariantsMap}
              isNewProduct={
                !isEditMode || !savedVariantsMap || savedVariantsMap.size === 0
              }
              onNavigateToVariant={requestNavigation}
            />
            <EnvironmentSection
              carbonKgCo2e={state.carbonKgCo2e}
              setCarbonKgCo2e={(value) => setField("carbonKgCo2e", value)}
              waterLiters={state.waterLiters}
              setWaterLiters={(value) => setField("waterLiters", value)}
              weightGrams={state.weightGrams}
              setWeightGrams={(value) => setField("weightGrams", value)}
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
              weightError={
                state.hasAttemptedSubmit
                  ? state.validationErrors.weightGrams
                  : undefined
              }
            />
            <MaterialsSection
              materials={state.materialData}
              setMaterials={(value) => setField("materialData", value)}
              materialsError={
                state.hasAttemptedSubmit
                  ? state.validationErrors.materials
                  : undefined
              }
              sectionRef={materialsSectionRef}
            />
            <JourneySection
              journeySteps={state.journeySteps}
              setJourneySteps={(value) => setField("journeySteps", value)}
            />
          </>
        }
        right={
          <>
            <StatusSidebar
              status={state.status}
              setStatus={(value) => setField("status", value)}
            />
            <IdentifiersSidebar
              productHandle={state.productHandle}
              setProductHandle={(value) => setField("productHandle", value)}
              manufacturerId={state.manufacturerId}
              setManufacturerId={(value) => setField("manufacturerId", value)}
              productHandleError={
                state.hasAttemptedSubmit
                  ? state.validationErrors.productHandle
                  : undefined
              }
              productHandleInputRef={productHandleInputRef}
            />
          </>
        }
      />

      {/* Variant Deletion Warning Modal */}
      <VariantDeletionModal
        open={variantDeletionModalOpen}
        onOpenChange={setVariantDeletionModalOpen}
        variants={pendingVariantDeletions}
        onConfirm={handleConfirmVariantDeletion}
        onCancel={handleCancelVariantDeletion}
      />
    </form>
  );
}

export function CreateProductForm() {
  return <ProductFormInner mode="create" />;
}

export function EditProductForm({
  productHandle,
}: {
  productHandle: string;
}) {
  const trpc = useTRPC();
  // Form pages should ALWAYS fetch fresh data on mount
  const { data } = useSuspenseQuery({
    ...trpc.products.get.queryOptions({
      handle: productHandle,
      includeVariants: true,
      includeAttributes: true,
    }),
    staleTime: 0,
    refetchOnMount: "always",
  });
  return (
    <ProductFormInner
      mode="edit"
      productHandle={productHandle}
      initialData={data}
    />
  );
}

// Legacy exports for backward compatibility during migration
export { CreateProductForm as CreatePassportForm };
export { EditProductForm as EditPassportForm };
