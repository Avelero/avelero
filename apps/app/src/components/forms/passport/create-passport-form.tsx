"use client";

import { BasicInfoSection } from "@/components/forms/passport/blocks/basic-info-block";
import { EnvironmentSection } from "@/components/forms/passport/blocks/environment-block";
import { JourneySection } from "@/components/forms/passport/blocks/journey-block";
import { MaterialsSection } from "@/components/forms/passport/blocks/materials-block";
import { OrganizationSection } from "@/components/forms/passport/blocks/organization-block";
import { VariantSection } from "@/components/forms/passport/blocks/variant-block";
import { PassportFormScaffold } from "@/components/forms/passport/scaffold/passport-form-scaffold";
import { IdentifiersSection } from "@/components/forms/passport/sidebar/identifiers-block";
import { StatusSection } from "@/components/forms/passport/sidebar/status-block";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { useBrandCatalog, type SizeOption } from "@/hooks/use-brand-catalog";
import { usePassportForm } from "@/hooks/use-passport-form";
import { getFirstInvalidField, isFormValid } from "@/hooks/use-form-validation";
import type { PassportFormValidationErrors } from "@/hooks/use-passport-form";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

interface PassportFormProps {
  mode: "create" | "edit";
  /** Product handle (URL-friendly identifier) for edit mode */
  productHandle?: string;
  /** Pre-fetched product data for edit mode (avoids cache sync issues) */
  initialData?: unknown;
}

export function PassportForm({ mode, productHandle, initialData }: PassportFormProps) {
  const { data: user } = useUserQuery();
  const { sizeOptions, colors: brandColors } = useBrandCatalog();
  const {
    setIsSubmitting: setContextIsSubmitting,
    setHasUnsavedChanges: setContextHasUnsavedChanges,
  } = usePassportFormContext();
  const isEditMode = mode === "edit";

  // Filter out colors without IDs (default colors not yet in DB)
  const availableColors = React.useMemo(
    () => brandColors.filter((c): c is { id: string; name: string; hex: string } => c.id !== undefined),
    [brandColors]
  );

  // Consolidated form hook (state + validation + submission)
  const {
    state,
    setField,
    updateField,
    clearValidationError,
    validate,
    submit,
    isSubmitting,
    hasUnsavedChanges,
  } = usePassportForm({ mode, productHandle, sizeOptions, colors: availableColors, initialData });

  const handleSelectedSizesChange = React.useCallback<
    React.Dispatch<React.SetStateAction<SizeOption[]>>
  >(
    (value) => {
      if (typeof value === "function") {
        updateField("selectedSizes", value);
      } else {
        setField("selectedSizes", value);
      }
    },
    [setField, updateField],
  );

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
      state.validationErrors.colors &&
      state.colorIds.length + state.pendingColors.length <= 12
    ) {
      clearValidationError("colors");
    }
  }, [
    state.colorIds,
    state.pendingColors,
    state.hasAttemptedSubmit,
    state.validationErrors.colors,
    clearValidationError,
  ]);

  React.useEffect(() => {
    if (
      state.hasAttemptedSubmit &&
      state.validationErrors.selectedSizes &&
      state.selectedSizes.length <= 12
    ) {
      clearValidationError("selectedSizes");
    }
  }, [
    state.selectedSizes,
    state.hasAttemptedSubmit,
    state.validationErrors.selectedSizes,
    clearValidationError,
  ]);

  React.useEffect(() => {
    if (
      state.hasAttemptedSubmit &&
      state.materialData.length > 0 &&
      state.validationErrors.materials
    ) {
      // Re-validate materials when they change
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

  React.useEffect(() => {
    setContextIsSubmitting(isSubmitting);
  }, [isSubmitting, setContextIsSubmitting]);

  React.useEffect(() => {
    setContextHasUnsavedChanges(isEditMode ? hasUnsavedChanges : false);
  }, [hasUnsavedChanges, isEditMode, setContextHasUnsavedChanges]);

  React.useEffect(() => {
    if (!isEditMode || !hasUnsavedChanges) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isEditMode]);

  // Refs for focusing invalid fields
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const productHandleInputRef = React.useRef<HTMLInputElement>(null);
  const materialsSectionRef = React.useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user?.brand_id) {
      return;
    }

    // Validate form
    const errors = validate();
    const missingRequired =
      !state.name.trim() || !state.productHandle.trim();
    const materialsErrorMessage = errors.materials;

    // If form is invalid, show toast and focus first invalid field
    if (!isFormValid(errors)) {
      if (missingRequired) {
        toast.error("Please fill in the required fields");
      } else if (materialsErrorMessage) {
        toast.error(materialsErrorMessage);
      } else {
        toast.error("Please fix the errors in the form before submitting");
      }

      // Focus on first invalid field
      const fieldOrder: Array<keyof PassportFormValidationErrors> = [
        "name",
        "productHandle",
        "colors",
        "selectedSizes",
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

    // Form is valid, proceed with submission
    try {
      await submit(user.brand_id);
    } catch (err) {
      // Error is already handled by the submission hook
      console.error("Form submission failed:", err);
    }
  };

  return (
    <form
      id="passport-form"
      className="flex justify-center w-full"
      onSubmit={handleSubmit}
    >
      <PassportFormScaffold
        title={mode === "create" ? "Create passport" : "Edit passport"}
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
                if (file) {
                  setField("existingImageUrl", null);
                }
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
              colorIds={state.colorIds}
              pendingColors={state.pendingColors}
              setColorIds={(value) => setField("colorIds", value)}
              setPendingColors={(value) => setField("pendingColors", value)}
              selectedSizes={state.selectedSizes}
              setSelectedSizes={handleSelectedSizesChange}
              variantData={state.variantData}
              updateVariantData={(updater) => updateField("variantData", updater)}
              colorsError={
                state.hasAttemptedSubmit
                  ? state.validationErrors.colors
                  : undefined
              }
              sizesError={
                state.hasAttemptedSubmit
                  ? state.validationErrors.selectedSizes
                  : undefined
              }
            />
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
            <StatusSection
              status={state.status}
              setStatus={(value) => setField("status", value)}
            />
            <IdentifiersSection
              productHandle={state.productHandle}
              setProductHandle={(value) =>
                setField("productHandle", value)
              }
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
    </form>
  );
}

// Convenience exports for backwards compatibility
export function CreatePassportForm() {
  return <PassportForm mode="create" />;
}

export function EditPassportForm({ productHandle }: { productHandle: string }) {
  const trpc = useTRPC();
  // Fetch and pass data directly - eliminates cache sync issues on client navigation
  const { data } = useSuspenseQuery(
    trpc.products.get.queryOptions({
      handle: productHandle,
      includeVariants: true,
      includeAttributes: true,
    }),
  );
  return <PassportForm mode="edit" productHandle={productHandle} initialData={data} />;
}
