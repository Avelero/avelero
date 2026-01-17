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
  FirstPublishModal,
  shouldShowFirstPublishModal,
} from "@/components/modals/first-publish-modal";
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
    setPublishingStatus,
    setHasDbUnpublishedChanges,
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
    resetForm,
    savedVariantsMap,
    productHandle: savedProductHandle,
    productId,
    dbPublishingStatus,
    dbHasUnpublishedChanges,
  } = usePassportForm({ mode, productHandle, initialData });

  // Publishing mutation
  const publishProductMutation = useMutation(
    trpc.products.publish.product.mutationOptions(),
  );

  // First publish modal state (for three-dot menu)
  const [showFirstPublishModal, setShowFirstPublishModal] =
    React.useState(false);

  // Sync productId and publishing state with context when they change
  React.useEffect(() => {
    setProductId(productId);
    setPublishingStatus(dbPublishingStatus);
    setHasDbUnpublishedChanges(dbHasUnpublishedChanges);
  }, [
    productId,
    setProductId,
    dbPublishingStatus,
    setPublishingStatus,
    dbHasUnpublishedChanges,
    setHasDbUnpublishedChanges,
  ]);

  // Actual publish logic
  const executePublish = React.useCallback(async () => {
    if (!productId) {
      toast.error("Cannot publish: product has not been saved yet");
      return;
    }

    try {
      const result = await publishProductMutation.mutateAsync({ productId });
      if (result.success) {
        toast.success("Product published successfully");

        // Update publishing status immediately in context so UI updates without page refresh
        setPublishingStatus("published");
        setHasDbUnpublishedChanges(false);

        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({
          queryKey: trpc.products.get.queryKey({
            handle: savedProductHandle ?? productHandle ?? "",
          }),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.products.list.queryKey(),
        });
      }
    } catch (err) {
      console.error("Publish failed:", err);
      toast.error("Failed to publish product");
    }
  }, [
    productId,
    publishProductMutation,
    queryClient,
    trpc,
    savedProductHandle,
    productHandle,
    setPublishingStatus,
    setHasDbUnpublishedChanges,
  ]);

  // Handle publish action - show modal on first publish if preference not set
  const handlePublish = React.useCallback(() => {
    if (!productId) {
      toast.error("Cannot publish: product has not been saved yet");
      return;
    }

    // On first publish, show warning modal (unless user dismissed it before)
    const isFirstPublish = dbPublishingStatus === "unpublished";
    if (isFirstPublish && shouldShowFirstPublishModal()) {
      setShowFirstPublishModal(true);
    } else {
      void executePublish();
    }
  }, [productId, dbPublishingStatus, executePublish]);

  // First publish modal handlers
  const handleFirstPublishConfirm = React.useCallback(() => {
    setShowFirstPublishModal(false);
    void executePublish();
  }, [executePublish]);

  const handleFirstPublishCancel = React.useCallback(() => {
    setShowFirstPublishModal(false);
  }, []);

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

  // Register reset callback with context so discard handler can reset form state
  React.useEffect(() => {
    formResetCallbackRef.current = resetForm;
    return () => {
      formResetCallbackRef.current = null;
    };
  }, [resetForm, formResetCallbackRef]);

  // Refs for focusing invalid fields
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const productHandleInputRef = React.useRef<HTMLInputElement>(null);
  const materialsSectionRef = React.useRef<HTMLDivElement>(null);

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

    try {
      await submit(user.brand_id);
    } catch (err) {
      console.error("Form submission failed:", err);
    }
  };

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
              publishingStatus={dbPublishingStatus}
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

      <FirstPublishModal
        open={showFirstPublishModal}
        onOpenChange={setShowFirstPublishModal}
        onConfirm={handleFirstPublishConfirm}
        onCancel={handleFirstPublishCancel}
        isPublishing={publishProductMutation.isPending}
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
