/**
 * Passport form context provider for centralized state management.
 *
 * This context manages all form fields, validation, and dirty state tracking
 * for the passport creation and edit forms. All form blocks read and write
 * data through this context to ensure consistency.
 *
 * State is not persisted to the API until the user clicks the "Save" button.
 * However, metadata (materials, facilities, etc.) created through nested sheets
 * is persisted immediately as per the design requirements.
 */

"use client";

import type {
  ColorOption,
  FacilityOption,
  MaterialOption,
  ProductionStepOption,
  SeasonOption,
  SelectOption,
  SizeOption,
} from "@/hooks/use-passport-form-data";
import { usePassportFormData } from "@/hooks/use-passport-form-data";
import * as React from "react";

/**
 * Material composition entry with percentage.
 */
export interface MaterialComposition {
  id: string; // Temporary ID for local state management
  materialId: string | null; // Brand material ID from API
  materialName: string;
  percentage: string;
  countryOfOrigin?: string;
}

/**
 * Journey step entry with facility and production step.
 */
export interface JourneyStep {
  id: string; // Temporary ID for local state management
  sortIndex: number;
  stepType: string; // Production step type (e.g., "cutting", "sewing")
  facilityId: string | null; // Facility ID from API
  facilityName: string;
}

/**
 * Complete form state structure.
 */
export interface PassportFormState {
  // Basic Info
  title: string;
  description: string;
  imageFile: File | null; // File to upload on save
  imagePreviewUrl: string | null; // Preview URL for display
  primaryImageUrl: string | null; // Final uploaded URL

  // Organization
  categoryId: string | null;
  season: SeasonOption | null;
  colors: ColorOption[];
  sizeId: string | null;
  tags: ColorOption[]; // Tags use same structure as colors (name + hex)
  showcaseBrandId: string | null;

  // Materials
  materials: MaterialComposition[];

  // Journey
  journeySteps: JourneyStep[];

  // Environment
  carbonKgCo2e: string;
  waterLiters: string;

  // Identifiers (sidebar)
  sku: string;
  status: "draft" | "in_progress" | "published";

  // Validation
  errors: Record<string, string>;
  isDirty: boolean;
}

/**
 * Initial form state with empty values.
 */
const initialFormState: PassportFormState = {
  title: "",
  description: "",
  imageFile: null,
  imagePreviewUrl: null,
  primaryImageUrl: null,
  categoryId: null,
  season: null,
  colors: [],
  sizeId: null,
  tags: [],
  showcaseBrandId: null,
  materials: [],
  journeySteps: [],
  carbonKgCo2e: "",
  waterLiters: "",
  sku: "",
  status: "draft",
  errors: {},
  isDirty: false,
};

/**
 * Context value combining form state and reference data.
 */
interface PassportFormContextValue {
  // Form state
  formState: PassportFormState;
  
  // Reference data from API
  referenceData: ReturnType<typeof usePassportFormData>["data"];
  isLoadingData: boolean;
  dataError: unknown;

  // State updaters
  updateField: <K extends keyof PassportFormState>(
    field: K,
    value: PassportFormState[K],
  ) => void;
  
  // Complex field updaters
  setImage: (file: File | null) => void;
  addMaterial: () => void;
  updateMaterial: (id: string, updates: Partial<MaterialComposition>) => void;
  removeMaterial: (id: string) => void;
  addJourneyStep: () => void;
  updateJourneyStep: (id: string, updates: Partial<JourneyStep>) => void;
  removeJourneyStep: (id: string) => void;
  reorderJourneySteps: (startIndex: number, endIndex: number) => void;

  // Validation
  validateForm: () => boolean;
  clearErrors: () => void;

  // Reset
  resetForm: () => void;
}

const PassportFormContext = React.createContext<
  PassportFormContextValue | undefined
>(undefined);

/**
 * Provider component for passport form context.
 *
 * Wraps the entire form and provides centralized state management for all
 * form fields and operations.
 *
 * @param props.children - Form components that need access to form state
 * @param props.initialData - Optional initial data for edit mode
 *
 * @example
 * ```tsx
 * <PassportFormProvider>
 *   <BasicInfoSection />
 *   <MaterialsSection />
 *   <JourneySection />
 * </PassportFormProvider>
 * ```
 */
export function PassportFormProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Partial<PassportFormState>;
}) {
  const [formState, setFormState] = React.useState<PassportFormState>({
    ...initialFormState,
    ...initialData,
  });

  // Fetch reference data for dropdowns
  const { data: referenceData, isLoading: isLoadingData, error: dataError } = usePassportFormData();

  /**
   * Generic field updater.
   */
  const updateField = React.useCallback(
    <K extends keyof PassportFormState>(
      field: K,
      value: PassportFormState[K],
    ) => {
      setFormState((prev) => ({
        ...prev,
        [field]: value,
        isDirty: true,
      }));
    },
    [],
  );

  /**
   * Set image file and generate preview URL.
   */
  const setImage = React.useCallback((file: File | null) => {
    if (!file) {
      setFormState((prev) => ({
        ...prev,
        imageFile: null,
        imagePreviewUrl: null,
        isDirty: true,
      }));
      return;
    }

    // Generate preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormState((prev) => ({
        ...prev,
        imageFile: file,
        imagePreviewUrl: e.target?.result as string,
        isDirty: true,
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  /**
   * Add a new empty material entry.
   */
  const addMaterial = React.useCallback(() => {
    const newMaterial: MaterialComposition = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      materialId: null,
      materialName: "",
      percentage: "",
    };
    setFormState((prev) => ({
      ...prev,
      materials: [...prev.materials, newMaterial],
      isDirty: true,
    }));
  }, []);

  /**
   * Update a specific material entry.
   */
  const updateMaterial = React.useCallback(
    (id: string, updates: Partial<MaterialComposition>) => {
      setFormState((prev) => ({
        ...prev,
        materials: prev.materials.map((m) =>
          m.id === id ? { ...m, ...updates } : m,
        ),
        isDirty: true,
      }));
    },
    [],
  );

  /**
   * Remove a material entry.
   */
  const removeMaterial = React.useCallback((id: string) => {
    setFormState((prev) => ({
      ...prev,
      materials: prev.materials.filter((m) => m.id !== id),
      isDirty: true,
    }));
  }, []);

  /**
   * Add a new empty journey step.
   */
  const addJourneyStep = React.useCallback(() => {
    const newStep: JourneyStep = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      sortIndex: formState.journeySteps.length,
      stepType: "",
      facilityId: null,
      facilityName: "",
    };
    setFormState((prev) => ({
      ...prev,
      journeySteps: [...prev.journeySteps, newStep],
      isDirty: true,
    }));
  }, [formState.journeySteps.length]);

  /**
   * Update a specific journey step.
   */
  const updateJourneyStep = React.useCallback(
    (id: string, updates: Partial<JourneyStep>) => {
      setFormState((prev) => ({
        ...prev,
        journeySteps: prev.journeySteps.map((step) =>
          step.id === id ? { ...step, ...updates } : step,
        ),
        isDirty: true,
      }));
    },
    [],
  );

  /**
   * Remove a journey step.
   */
  const removeJourneyStep = React.useCallback((id: string) => {
    setFormState((prev) => ({
      ...prev,
      journeySteps: prev.journeySteps
        .filter((step) => step.id !== id)
        .map((step, index) => ({ ...step, sortIndex: index })),
      isDirty: true,
    }));
  }, []);

  /**
   * Reorder journey steps (for drag and drop).
   */
  const reorderJourneySteps = React.useCallback(
    (startIndex: number, endIndex: number) => {
      setFormState((prev) => {
        const steps = [...prev.journeySteps];
        const [removed] = steps.splice(startIndex, 1);
        if (removed) {
          steps.splice(endIndex, 0, removed);
        }
        // Update sort indices
        return {
          ...prev,
          journeySteps: steps.map((step, index) => ({
            ...step,
            sortIndex: index,
          })),
          isDirty: true,
        };
      });
    },
    [],
  );

  /**
   * Validate form and return true if valid.
   */
  const validateForm = React.useCallback(() => {
    const errors: Record<string, string> = {};

    // Required fields
    if (!formState.title.trim()) {
      errors.title = "Title is required";
    }

    if (!formState.sku.trim()) {
      errors.sku = "SKU is required";
    }

    // Material percentages must sum to 100 if any materials are added
    if (formState.materials.length > 0) {
      const totalPercentage = formState.materials.reduce((sum, m) => {
        const percentage = Number.parseFloat(m.percentage) || 0;
        return sum + percentage;
      }, 0);

      if (totalPercentage !== 100) {
        errors.materials = "Material percentages must sum to 100%";
      }
    }

    setFormState((prev) => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [formState.title, formState.sku, formState.materials]);

  /**
   * Clear all validation errors.
   */
  const clearErrors = React.useCallback(() => {
    setFormState((prev) => ({ ...prev, errors: {} }));
  }, []);

  /**
   * Reset form to initial state.
   */
  const resetForm = React.useCallback(() => {
    setFormState({
      ...initialFormState,
      ...initialData,
    });
  }, [initialData]);

  const contextValue: PassportFormContextValue = {
    formState,
    referenceData: referenceData || ({} as any),
    isLoadingData,
    dataError,
    updateField,
    setImage,
    addMaterial,
    updateMaterial,
    removeMaterial,
    addJourneyStep,
    updateJourneyStep,
    removeJourneyStep,
    reorderJourneySteps,
    validateForm,
    clearErrors,
    resetForm,
  };

  return (
    <PassportFormContext.Provider value={contextValue}>
      {children}
    </PassportFormContext.Provider>
  );
}

/**
 * Hook to access passport form context.
 *
 * Must be used within a PassportFormProvider.
 *
 * @throws Error if used outside of PassportFormProvider
 *
 * @example
 * ```tsx
 * function BasicInfoSection() {
 *   const { formState, updateField } = usePassportFormContext();
 *
 *   return (
 *     <Input
 *       value={formState.title}
 *       onChange={(e) => updateField('title', e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function usePassportFormContext() {
  const context = React.useContext(PassportFormContext);
  if (!context) {
    throw new Error(
      "usePassportFormContext must be used within PassportFormProvider",
    );
  }
  return context;
}

