/**
 * useVariantForm
 *
 * Form state management hook for editing variant-level overrides.
 * Simpler than usePassportForm since we only handle a subset of fields.
 */

import { useFormState } from "@/hooks/use-form-state";
import { useImageUpload } from "@/hooks/use-upload";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

// ============================================================================
// Types
// ============================================================================

// Materials use materialId to match MaterialsSection props
interface MaterialData {
  materialId: string;
  percentage: number;
}

interface JourneyStep {
  stepType: string;
  operatorId: string;
  sortIndex: number;
}

export interface VariantFormValues {
  // Core display
  name: string;
  description: string;
  imageFile: File | null;
  existingImageUrl: string | null;

  // Environment
  carbonKgCo2e: string;
  waterLiters: string;

  // Weight
  weightGrams: string;

  // Materials (uses materialId to match MaterialsSection)
  materials: MaterialData[];

  // Journey
  journeySteps: JourneyStep[];
}

interface VariantFormState extends VariantFormValues {
  validationErrors: VariantFormValidationErrors;
  hasAttemptedSubmit: boolean;
}

export interface VariantFormValidationErrors {
  name?: string;
  carbonKgCo2e?: string;
  waterLiters?: string;
  weightGrams?: string;
  materials?: string;
}

interface UseVariantFormOptions {
  productHandle: string;
  variantUpid: string;
  initialData?: {
    name: string | null;
    description: string | null;
    imagePath: string | null;
    environment: {
      carbonKgCo2e: string | null;
      waterLiters: string | null;
    } | null;
    weight: {
      weight: string | null;
      weightUnit: string | null;
    } | null;
    materials: Array<{ brandMaterialId: string; percentage: string | null }>;
    journey: Array<{ sortIndex: number; stepType: string; operatorId: string }>;
  };
  /** Product-level defaults to show as placeholders */
  productDefaults?: {
    name: string;
    description: string | null;
    imagePath: string | null;
  };
}

// Initial empty state
const initialFormValues: VariantFormValues = {
  name: "",
  description: "",
  imageFile: null,
  existingImageUrl: null,
  carbonKgCo2e: "",
  waterLiters: "",
  weightGrams: "",
  materials: [],
  journeySteps: [],
};

// ============================================================================
// Hook
// ============================================================================

export function useVariantForm(options: UseVariantFormOptions) {
  const { productHandle, variantUpid, initialData, productDefaults } = options;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Build initial state from initialData
  const buildInitialState = React.useCallback((): VariantFormState => {
    if (!initialData) {
      return {
        ...initialFormValues,
        validationErrors: {},
        hasAttemptedSubmit: false,
      };
    }

    return {
      name: initialData.name ?? "",
      description: initialData.description ?? "",
      imageFile: null,
      existingImageUrl: initialData.imagePath,
      carbonKgCo2e: initialData.environment?.carbonKgCo2e ?? "",
      waterLiters: initialData.environment?.waterLiters ?? "",
      weightGrams: initialData.weight?.weight ?? "",
      // Map brandMaterialId -> materialId for MaterialsSection compatibility
      materials: initialData.materials.map((m) => ({
        materialId: m.brandMaterialId,
        percentage: m.percentage ? Number.parseFloat(m.percentage) : 0,
      })),
      journeySteps: initialData.journey.map((j) => ({
        stepType: j.stepType,
        operatorId: j.operatorId,
        sortIndex: j.sortIndex,
      })),
      validationErrors: {},
      hasAttemptedSubmit: false,
    };
  }, [initialData]);

  const { state, setField, updateField, setFields } =
    useFormState<VariantFormState>(buildInitialState());

  // Track original values for change detection
  const originalValuesRef = React.useRef<VariantFormState>(buildInitialState());

  // Track the variant we're editing to detect navigation
  const lastVariantUpidRef = React.useRef(variantUpid);

  // Create a stable key for initialData to detect when it changes
  const initialDataKey = React.useMemo(() => {
    if (!initialData) return "empty";
    return JSON.stringify({
      name: initialData.name,
      description: initialData.description,
      imagePath: initialData.imagePath,
      env: initialData.environment,
      weight: initialData.weight,
      mat: initialData.materials,
      journey: initialData.journey,
    });
  }, [initialData]);
  const lastInitialDataKeyRef = React.useRef(initialDataKey);

  // Sync form state when navigating to a different variant OR when initialData becomes available
  React.useEffect(() => {
    const upidChanged = variantUpid !== lastVariantUpidRef.current;
    const dataChanged = initialDataKey !== lastInitialDataKeyRef.current;

    if (upidChanged || dataChanged) {
      // Navigating to different variant or data just loaded - reset form
      const newState = buildInitialState();
      setFields(newState);
      originalValuesRef.current = newState;
      lastVariantUpidRef.current = variantUpid;
      lastInitialDataKeyRef.current = initialDataKey;
    }
  }, [variantUpid, initialDataKey, buildInitialState, setFields]);

  // Image upload hook
  const { uploadImage, buildPath: buildImagePath } = useImageUpload();

  // Use the unified variants.update mutation with overrides
  const updateVariantMutation = useMutation(
    trpc.products.variants.update.mutationOptions(),
  );

  // Is submitting
  const isSubmitting = updateVariantMutation.isPending;

  // Check for unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    const orig = originalValuesRef.current;

    if (state.name !== orig.name) return true;
    if (state.description !== orig.description) return true;
    if (state.imageFile !== null) return true; // New image selected
    if (state.carbonKgCo2e !== orig.carbonKgCo2e) return true;
    if (state.waterLiters !== orig.waterLiters) return true;
    if (state.weightGrams !== orig.weightGrams) return true;

    // Compare materials
    if (state.materials.length !== orig.materials.length) return true;
    for (let i = 0; i < state.materials.length; i++) {
      const curr = state.materials[i];
      const origM = orig.materials[i];
      if (curr?.materialId !== origM?.materialId) return true;
      if (curr?.percentage !== origM?.percentage) return true;
    }

    // Compare journey
    if (state.journeySteps.length !== orig.journeySteps.length) return true;
    for (let i = 0; i < state.journeySteps.length; i++) {
      const curr = state.journeySteps[i];
      const origJ = orig.journeySteps[i];
      if (curr?.stepType !== origJ?.stepType) return true;
      if (curr?.operatorId !== origJ?.operatorId) return true;
      if (curr?.sortIndex !== origJ?.sortIndex) return true;
    }

    return false;
  }, [state]);

  // Validation
  const validate = React.useCallback((): VariantFormValidationErrors => {
    const errors: VariantFormValidationErrors = {};

    // Carbon must be valid number if provided
    if (state.carbonKgCo2e.trim()) {
      const val = Number.parseFloat(state.carbonKgCo2e);
      if (Number.isNaN(val) || val < 0) {
        errors.carbonKgCo2e = "Carbon must be a positive number";
      }
    }

    // Water must be valid number if provided
    if (state.waterLiters.trim()) {
      const val = Number.parseFloat(state.waterLiters);
      if (Number.isNaN(val) || val < 0) {
        errors.waterLiters = "Water must be a positive number";
      }
    }

    // Weight must be valid number if provided
    if (state.weightGrams.trim()) {
      const val = Number.parseFloat(state.weightGrams);
      if (Number.isNaN(val) || val < 0) {
        errors.weightGrams = "Weight must be a positive number";
      }
    }

    // Materials percentage validation
    let totalPercentage = 0;
    for (const material of state.materials) {
      if (material.percentage) {
        if (material.percentage < 0) {
          errors.materials = "Material percentages must be positive numbers";
          break;
        }
        totalPercentage += material.percentage;
      }
    }
    if (totalPercentage > 100) {
      errors.materials = `Material percentages sum to ${totalPercentage.toFixed(1)}%, but cannot exceed 100%`;
    }

    setField("validationErrors", errors);
    return errors;
  }, [state, setField]);

  // Clear a validation error
  const clearValidationError = React.useCallback(
    (field: keyof VariantFormValidationErrors) => {
      updateField("validationErrors", (prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [updateField],
  );

  // Submit handler - uses the unified update mutation with overrides
  const submit = React.useCallback(async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setField("hasAttemptedSubmit", true);
      throw new Error("Validation failed");
    }

    try {
      // Upload image if changed
      let imagePath = state.existingImageUrl;
      if (state.imageFile) {
        const path = buildImagePath(["variants", variantUpid], state.imageFile);
        const result = await uploadImage({
          file: state.imageFile,
          bucket: "products",
          path,
          isPublic: true,
          validation: {
            maxBytes: 10 * 1024 * 1024, // 10MB
            allowedMime: [
              "image/jpeg",
              "image/jpg",
              "image/png",
              "image/webp",
              "image/avif",
            ],
          },
        });
        imagePath = result.displayUrl;
      }

      // Build overrides object for the update mutation
      const overrides: Record<string, unknown> = {};

      // Core fields
      overrides.name = state.name || null;
      overrides.description = state.description || null;
      overrides.imagePath = imagePath || null;

      // Environment
      overrides.environment = {
        carbonKgCo2e: state.carbonKgCo2e || null,
        waterLiters: state.waterLiters || null,
      };

      // Weight
      overrides.weight = {
        weight: state.weightGrams || null,
        weightUnit: state.weightGrams ? "g" : null,
      };

      // Materials (map materialId -> brandMaterialId for API)
      overrides.materials = state.materials.map((m) => ({
        brandMaterialId: m.materialId,
        percentage: m.percentage > 0 ? String(m.percentage) : null,
      }));

      // Journey
      overrides.journey = state.journeySteps.map((j) => ({
        stepType: j.stepType,
        operatorId: j.operatorId,
        sortIndex: j.sortIndex,
      }));

      // Call the unified update mutation
      await updateVariantMutation.mutateAsync({
        productHandle,
        variantUpid,
        overrides,
      });

      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: trpc.products.variants.getOverrides.queryKey({
          productHandle,
          variantUpid,
        }),
      });

      // Update original values ref
      originalValuesRef.current = { ...state };

      toast.success("Variant saved successfully");
    } catch (error) {
      console.error("Failed to save variant:", error);
      toast.error("Failed to save variant");
      throw error;
    }
  }, [
    state,
    validate,
    setField,
    uploadImage,
    buildImagePath,
    productHandle,
    variantUpid,
    updateVariantMutation,
    queryClient,
    trpc,
  ]);

  // Reset form to initial state (called when discarding changes)
  const resetForm = React.useCallback(() => {
    const initialState = buildInitialState();
    setFields(initialState);
    originalValuesRef.current = initialState;
  }, [buildInitialState, setFields]);

  return {
    state,
    setField,
    updateField,
    validate,
    clearValidationError,
    submit,
    isSubmitting,
    hasUnsavedChanges,
    productDefaults,
    resetForm,
  };
}
