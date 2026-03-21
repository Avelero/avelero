/**
 * usePassportForm
 *
 * Form state management hook for creating and editing passport-level product data.
 */
import type {
  ExplicitVariant,
  ExpandedVariantMappings,
  VariantDimension,
  VariantMetadata,
} from "@/components/forms/passport/blocks/variant-block";
import { useFormState } from "@/hooks/use-form-state";
import {
  type ValidationErrors,
  type ValidationSchema,
  isFormValid,
  rules,
  validateForm,
} from "@/hooks/use-form-validation";
import { useImageUpload } from "@/hooks/use-upload";
import {
  MAX_PERCENTAGE_UNITS,
  formatPercentageFromUnits,
  isPercentageWithinBounds,
  toPercentageUnits,
} from "@/lib/percentage-utils";
import {
  generateVariantCombinationKeys,
  variantDimensionHasValues,
} from "@/lib/variant-utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import { useRouter } from "next/navigation";
import * as React from "react";

// ============================================================================
// Types
// ============================================================================

export interface PassportFormValues {
  // Basic info
  name: string;
  productHandle: string;
  description: string;
  imageFile: File | null;
  existingImageUrl: string | null;

  // Organization
  categoryId: string | null;
  seasonId: string | null;
  manufacturerId: string | null;
  tagIds: string[];

  // Variants (new generic attribute system)
  variantDimensions: VariantDimension[];
  variantMetadata: Record<string, VariantMetadata>;
  explicitVariants: ExplicitVariant[];
  /**
   * Tracks which variant combinations are enabled (exist).
   * Keys are pipe-separated value IDs, e.g., "red-value-id|S-value-id".
   * This allows heterogeneous variants where not all combinations from the
   * cartesian product need to exist.
   */
  enabledVariantKeys: Set<string>;
  /**
   * Maps expanded/collapsed variant keys to their original variant ID/UPID.
   * When dimensions are added/removed, this preserves the link between new keys
   * and existing variants so they can be updated rather than recreated.
   */
  expandedVariantMappings: ExpandedVariantMappings;

  // Materials
  materialData: Array<{ materialId: string; percentage: number }>;

  // Journey
  journeySteps: Array<{
    stepType: string;
    operatorIds: string[];
    sortIndex: number;
  }>;

  // Environment
  carbonKgCo2e: string;
  waterLiters: string;

  // Weight
  weightGrams: string;

  // Status
  status: string;
}

export interface PassportFormState extends PassportFormValues {
  validationErrors: PassportFormValidationErrors;
  hasAttemptedSubmit: boolean;
}

interface UsePassportFormOptions {
  mode?: "create" | "edit";
  productHandle?: string;
  initialData?: unknown;
}

/**
 * Builds the default explicit variant row for no-attribute products.
 */
function createEmptyExplicitVariant(): ExplicitVariant {
  return {
    sku: "",
    barcode: "",
  };
}

const initialFormValues: PassportFormValues = {
  name: "",
  productHandle: "",
  description: "",
  imageFile: null,
  existingImageUrl: null,
  categoryId: null,
  seasonId: null,
  manufacturerId: null,
  tagIds: [],
  variantDimensions: [],
  variantMetadata: {},
  explicitVariants: [createEmptyExplicitVariant()],
  enabledVariantKeys: new Set<string>(),
  expandedVariantMappings: new Map(),
  materialData: [],
  journeySteps: [],
  carbonKgCo2e: "",
  waterLiters: "",
  weightGrams: "",
  status: "unpublished",
};

// ============================================================================
// Barcode Validation
// ============================================================================

/** GS1 GTIN barcode format: 8, 12, 13, or 14 digits */
const BARCODE_REGEX = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

/** Normalize barcode to GTIN-14 for comparison (pad with leading zeros) */
function normalizeToGtin14(barcode: string): string {
  return barcode.padStart(14, "0");
}

/**
 * Validates all barcodes in the form for:
 * 1. Format validity (8, 12, 13, or 14 digits)
 * 2. Local duplicates (same barcode used on multiple variants)
 *
 * Returns true if there are any barcode errors.
 */
function computeHasBarcodeErrors(
  variantMetadata: Record<string, { sku?: string; barcode?: string }>,
  explicitVariants: ExplicitVariant[],
  enabledVariantKeys: Set<string>,
): boolean {
  // Collect all barcodes from enabled variants
  const allBarcodes: string[] = [];

  // Check variantMetadata barcodes (attribute-based variants)
  for (const [key, meta] of Object.entries(variantMetadata)) {
    // Only check enabled variants
    if (!enabledVariantKeys.has(key)) continue;

    const barcode = meta.barcode?.trim();
    if (!barcode) continue;

    // Check format validity
    if (!BARCODE_REGEX.test(barcode)) {
      return true; // Invalid format
    }

    allBarcodes.push(normalizeToGtin14(barcode));
  }

  // Check explicit variants (no-attribute variants)
  for (const variant of explicitVariants) {
    const barcode = variant.barcode?.trim();
    if (!barcode) continue;

    // Check format validity
    if (!BARCODE_REGEX.test(barcode)) {
      return true; // Invalid format
    }

    allBarcodes.push(normalizeToGtin14(barcode));
  }

  // Check for duplicates (same normalized barcode appearing more than once)
  const seenBarcodes = new Set<string>();
  for (const normalizedBarcode of allBarcodes) {
    if (seenBarcodes.has(normalizedBarcode)) {
      return true; // Duplicate found
    }
    seenBarcodes.add(normalizedBarcode);
  }

  return false;
}

// ============================================================================
// Validation
// ============================================================================

export interface PassportFormValidationErrors {
  name?: string;
  productHandle?: string;
  description?: string;
  variants?: string;
  materials?: string;
  carbonKgCo2e?: string;
  waterLiters?: string;
  weightGrams?: string;
}

type PassportFormValidationFields = Pick<
  PassportFormValues,
  | "name"
  | "productHandle"
  | "description"
  | "materialData"
  | "carbonKgCo2e"
  | "waterLiters"
  | "weightGrams"
>;

const passportFormSchema: ValidationSchema<PassportFormValidationFields> = {
  name: [
    rules.required("Name is required"),
    rules.maxLength(100, "Name must be 100 characters or less"),
  ],
  productHandle: [
    rules.maxLength(100, "Product handle must be 100 characters or less"),
    (value) => {
      if (value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        return "Product handle must contain only lowercase letters, numbers, and dashes";
      }
      return undefined;
    },
  ],
  description: [
    rules.maxLength(2000, "Description must be 2000 characters or less"),
  ],
  carbonKgCo2e: [
    rules.positiveNumeric("Carbon value must be a valid positive number"),
  ],
  waterLiters: [
    rules.positiveNumeric("Water value must be a valid positive number"),
  ],
  weightGrams: [
    rules.positiveNumeric("Weight must be a valid positive number"),
  ],
  materialData: [
    (materials) => {
      if (!materials || materials.length === 0) return undefined;

      let totalUnits = 0;
      for (const material of materials) {
        if (!material.materialId || material.materialId.startsWith("temp-")) {
          return "All materials must be selected";
        }
        if (!Number.isFinite(material.percentage)) {
          return "Material percentages must be valid numbers";
        }
        if (!isPercentageWithinBounds(material.percentage)) {
          return "Material percentages must be between 0 and 100";
        }
        totalUnits += toPercentageUnits(material.percentage);
      }

      if (totalUnits > MAX_PERCENTAGE_UNITS) {
        return `Material percentages sum to ${formatPercentageFromUnits(totalUnits)}%, but cannot exceed 100%`;
      }

      return undefined;
    },
  ],
};

function mapValidationErrors(
  errors: ValidationErrors<PassportFormValidationFields>,
): PassportFormValidationErrors {
  const mapped: PassportFormValidationErrors = {};
  if (errors.name) mapped.name = errors.name;
  if (errors.productHandle) mapped.productHandle = errors.productHandle;
  if (errors.description) mapped.description = errors.description;
  if ((errors as any).materialData)
    mapped.materials = (errors as any).materialData;
  if (errors.carbonKgCo2e) mapped.carbonKgCo2e = errors.carbonKgCo2e;
  if (errors.waterLiters) mapped.waterLiters = errors.waterLiters;
  if (errors.weightGrams) mapped.weightGrams = errors.weightGrams;
  return mapped;
}

function getPassportValidationErrors(
  values: PassportFormValues,
): PassportFormValidationErrors {
  const fields: PassportFormValidationFields = {
    name: values.name,
    productHandle: values.productHandle,
    description: values.description,
    materialData: values.materialData,
    carbonKgCo2e: values.carbonKgCo2e,
    waterLiters: values.waterLiters,
    weightGrams: values.weightGrams,
  };
  const errors = validateForm(fields, passportFormSchema);
  return mapValidationErrors(errors);
}

/**
 * Returns an inline variants error when explicit rows cannot be mapped safely.
 */
function getVariantStructureError(
  values: PassportFormValues,
): string | undefined {
  const dimensionsWithValues = values.variantDimensions.filter((dimension) =>
    variantDimensionHasValues(dimension),
  );

  if (dimensionsWithValues.length === 0) {
    return undefined;
  }

  if (values.explicitVariants.length === 0) {
    return undefined;
  }

  const combinationCount = generateVariantCombinationKeys(
    values.variantDimensions,
  ).length;

  if (combinationCount < values.explicitVariants.length) {
    return `Add at least ${values.explicitVariants.length} variant combinations before saving to preserve the existing no-attribute variants.`;
  }

  return undefined;
}

function stripTrailingZeros(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value);
  if (str.includes(".")) return str.replace(/\.?0+$/, "");
  return str;
}

/**
 * Builds a cache/version fingerprint that changes when product or variant data changes.
 */
function buildProductDataVersion(data: any): string | null {
  if (!data) return null;

  const variants = Array.isArray(data.variants) ? data.variants : [];
  const variantVersions = variants
    .map((variant: any) => {
      const variantId = variant.upid ?? variant.id ?? "";
      const updatedAt = variant.updated_at ?? variant.updatedAt ?? "";
      const sku = variant.sku ?? "";
      const barcode = variant.barcode ?? "";
      const attributes = Array.isArray(variant.attributes)
        ? variant.attributes
            .map((attribute: any) => attribute.value_id ?? attribute.valueId ?? "")
            .filter(Boolean)
            .join("|")
        : "";

      return `${variantId}:${updatedAt}:${sku}:${barcode}:${attributes}`;
    })
    .sort()
    .join(",");

  const status = data.status ?? "unpublished";
  const updatedAt = data.updated_at ?? data.updatedAt ?? "";

  return `${data.id}:${status}:${updatedAt}:${variants.length}:${variantVersions}`;
}

// ============================================================================
// Hook
// ============================================================================

export function usePassportForm(options?: UsePassportFormOptions) {
  const mode = options?.mode ?? "create";
  const productHandle = options?.productHandle ?? null;
  const initialData = options?.initialData;
  const isEditMode = mode === "edit";

  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uploadImage, buildPath } = useImageUpload();

  const {
    state: formValues,
    setField,
    setFields,
    updateField,
    resetForm: resetFormValues,
  } = useFormState(initialFormValues);

  const [validationErrors, setValidationErrors] =
    React.useState<PassportFormValidationErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    null,
  );

  // Store the last hydrated values so we can revert to them when discarding changes
  const hydratedValuesRef = React.useRef<PassportFormValues | null>(null);

  // Database publishing state (from loaded product data)
  const [dbPublishingStatus, setDbPublishingStatus] = React.useState<
    "published" | "unpublished" | null
  >(null);

  const metadataRef = React.useRef<{
    productId?: string;
    productHandle?: string;
  }>({});
  const hasHydratedRef = React.useRef(false);
  const lastHydratedHandleRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (productHandle !== lastHydratedHandleRef.current) {
      hasHydratedRef.current = false;
      lastHydratedHandleRef.current = productHandle;
    }
  }, [productHandle]);

  // Reset form when in create mode on mount
  // useLayoutEffect runs synchronously before paint, ensuring the form is empty before user sees it
  // We use a ref to only reset once per mount to avoid resetting on every render
  const hasMountedRef = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!isEditMode && !hasMountedRef.current) {
      // First render in create mode - reset everything
      resetFormValues();
      setValidationErrors({});
      setHasAttemptedSubmit(false);
      setInitialSnapshot(null);
      hasHydratedRef.current = false;
      lastHydratedDataVersionRef.current = null;
    }
    hasMountedRef.current = true;

    // Cleanup on unmount - reset the flag for next mount
    return () => {
      hasMountedRef.current = false;
    };
  }, [isEditMode, resetFormValues]);

  const createProductMutation = useMutation(
    trpc.products.create.mutationOptions(),
  );
  const updateProductMutation = useMutation(
    trpc.products.update.mutationOptions(),
  );
  const syncVariantsMutation = useMutation(
    trpc.products.variants.sync.mutationOptions(),
  );
  const publishProductMutation = useMutation(
    trpc.products.publish.product.mutationOptions(),
  );
  const createAttributeMutation = useMutation(
    trpc.catalog.attributes.create.mutationOptions(),
  );
  const createAttributeValueMutation = useMutation(
    trpc.catalog.attributeValues.create.mutationOptions(),
  );

  const passportFormQuery = useQuery({
    ...trpc.products.get.queryOptions({
      handle: productHandle ?? "",
      includeVariants: true,
      includeAttributes: true,
    }),
    enabled: isEditMode && !!productHandle && !initialData,
    initialData: initialData as any,
    // Form pages should ALWAYS fetch fresh data on mount
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Track the last data version we hydrated from, to detect when data changes
  // This allows re-hydration when navigating back after external changes (e.g., variant deletion, status change)
  const lastHydratedDataVersionRef = React.useRef<string | null>(null);
  const currentDataVersion = React.useMemo(() => {
    return buildProductDataVersion(passportFormQuery.data);
  }, [passportFormQuery.data]);

  const state: PassportFormState = React.useMemo(
    () => ({ ...formValues, validationErrors, hasAttemptedSubmit }),
    [formValues, validationErrors, hasAttemptedSubmit],
  );

  // Compute a map of variant value keys -> variant info for navigation in edit mode.
  const savedVariantsMap = React.useMemo(() => {
    if (!isEditMode || !passportFormQuery.data)
      return new Map<
        string,
        {
          id: string;
          upid: string;
          hasOverrides: boolean;
          sku: string | null;
          barcode: string | null;
          attributeLabel: string;
        }
      >();

    const payload = passportFormQuery.data as any;
    const variants = Array.isArray(payload?.variants) ? payload.variants : [];
    const map = new Map<
      string,
      {
        id: string;
        upid: string;
        hasOverrides: boolean;
        sku: string | null;
        barcode: string | null;
        attributeLabel: string;
      }
    >();

    for (const variant of variants) {
      const id = variant.id;
      const upid = variant.upid ?? variant.unique_product_id;
      if (!id || !upid) continue;

      const attrs = variant.attributes ?? [];
      const valueKeys = attrs
        .map((a: any) => a.value_id ?? a.valueId)
        .filter(Boolean);

      // Build attribute label from value names (e.g., "Black / S")
      const attributeLabel =
        attrs.length > 0
          ? attrs.map((a: any) => a.value_name).join(" / ")
          : variant.sku || variant.barcode || `Variant ${upid.slice(0, 6)}`;

      if (valueKeys.length > 0) {
        const key = valueKeys.join("|");
        map.set(key, {
          id,
          upid,
          hasOverrides: variant.hasOverrides ?? false,
          sku: variant.sku ?? null,
          barcode: variant.barcode ?? null,
          attributeLabel,
        });
      }
    }

    return map;
  }, [isEditMode, passportFormQuery.data]);

  // Sync enabledVariantKeys with savedVariantsMap when variants are deleted externally
  // This handles the case where a user deletes a variant from the variant edit page
  // and navigates back - the deleted variant should not show as "new"
  const prevSavedVariantsRef = React.useRef<Map<
    string,
    {
      id: string;
      upid: string;
      hasOverrides: boolean;
      sku: string | null;
      barcode: string | null;
      attributeLabel: string;
    }
  > | null>(null);
  React.useEffect(() => {
    // Only run after initial hydration is complete
    if (!isEditMode || !hasHydratedRef.current) return;

    // Skip if savedVariantsMap is empty (would clear everything on first load)
    if (!savedVariantsMap || savedVariantsMap.size === 0) {
      prevSavedVariantsRef.current = savedVariantsMap;
      return;
    }

    // Detect if any variants were removed from savedVariantsMap
    const prevMap = prevSavedVariantsRef.current;
    if (prevMap && prevMap.size > savedVariantsMap.size) {
      // Find which variants were deleted
      const deletedKeys = new Set<string>();
      for (const [key] of prevMap) {
        if (!savedVariantsMap.has(key)) {
          deletedKeys.add(key);
        }
      }

      // Remove deleted variants from enabledVariantKeys
      if (deletedKeys.size > 0) {
        const updatedKeys = new Set(
          [...formValues.enabledVariantKeys].filter(
            (key) => !deletedKeys.has(key),
          ),
        );
        setFields({ enabledVariantKeys: updatedKeys });
      }
    }

    prevSavedVariantsRef.current = savedVariantsMap;
  }, [isEditMode, savedVariantsMap, setFields, formValues.enabledVariantKeys]);

  const clearValidationError = React.useCallback(
    (field: keyof PassportFormValidationErrors) => {
      setValidationErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const computeComparableState = React.useCallback(
    (values: PassportFormValues) => ({
      name: values.name,
      productHandle: values.productHandle,
      description: values.description,
      categoryId: values.categoryId,
      seasonId: values.seasonId,
      manufacturerId: values.manufacturerId,
      tagIds: values.tagIds,
      variantDimensions: values.variantDimensions.map((d) => ({
        attributeId: d.attributeId,
        values: d.values,
        isCustomInline: d.isCustomInline,
        customAttributeName: d.customAttributeName,
        customValues: d.customValues,
      })),
      variantMetadata: values.variantMetadata,
      explicitVariants: values.explicitVariants,
      enabledVariantKeys: Array.from(values.enabledVariantKeys).sort(),
      materialData: values.materialData,
      journeySteps: values.journeySteps.map((step) => ({
        sortIndex: step.sortIndex,
        stepType: step.stepType,
        operatorIds: step.operatorIds,
      })),
      carbonKgCo2e: values.carbonKgCo2e,
      waterLiters: values.waterLiters,
      weightGrams: values.weightGrams,
      status: values.status,
      existingImageUrl: values.existingImageUrl,
      imageFileName: values.imageFile
        ? `${values.imageFile.name}:${values.imageFile.lastModified}`
        : null,
    }),
    [],
  );

  /**
   * Builds the local form state from a fetched product payload.
   */
  const buildHydratedValuesFromPayload = React.useCallback(
    (payload: any): PassportFormValues => {
      const variants = Array.isArray(payload?.variants) ? payload.variants : [];

      // Build dimensions and metadata from variant attributes
      // Store brand attribute value IDs so custom names (e.g. "Sky Blue") rehydrate correctly
      const dimensionMap = new Map<
        string,
        {
          attributeId: string;
          name: string;
          values: Set<string>;
        }
      >();
      const metadata: Record<string, VariantMetadata> = {};

      for (const variant of variants) {
        const attrs = variant.attributes ?? [];
        const valueKeys: string[] = [];

        for (const attr of attrs) {
          const attrId = attr.attribute_id ?? attr.attributeId;
          const brandValueId = attr.value_id ?? attr.valueId;
          const attrName =
            attr.attribute_name ?? attr.attributeName ?? "Unknown";
          if (attrId && brandValueId) {
            if (!dimensionMap.has(attrId)) {
              dimensionMap.set(attrId, {
                attributeId: attrId,
                name: attrName,
                values: new Set(),
              });
            }

            const dim = dimensionMap.get(attrId)!;
            // Store the brand attribute value ID (not taxonomy_value_id)
            dim.values.add(brandValueId);
            valueKeys.push(brandValueId);
          }
        }

        // Build metadata key using brand value IDs
        if (valueKeys.length > 0) {
          const key = valueKeys.join("|");
          metadata[key] = {
            sku: variant.sku ?? "",
            barcode: variant.barcode ?? "",
          };
        }
      }

      // Convert to dimensions array
      const variantDimensions: VariantDimension[] = Array.from(
        dimensionMap.values(),
      ).map((dimension, idx) => ({
        id: `dim-${idx}`,
        attributeId: dimension.attributeId,
        attributeName: dimension.name,
        values: Array.from(dimension.values),
      }));

      // Compute enabled variant keys from actual existing variants
      // This allows heterogeneous products where not all combinations exist
      const enabledVariantKeys = new Set<string>();
      for (const variant of variants) {
        const attrs = variant.attributes ?? [];
        const valueKeys = attrs
          .map((attribute: any) => attribute.value_id ?? attribute.valueId)
          .filter(Boolean);
        if (valueKeys.length > 0) {
          enabledVariantKeys.add(valueKeys.join("|"));
        }
      }

      // Build explicit variants when the product currently has no attribute dimensions.
      const explicitVariants: ExplicitVariant[] =
        variantDimensions.length === 0
          ? variants.length > 0
            ? variants.map((variant: any) => ({
                id: variant.id,
                upid: variant.upid ?? variant.unique_product_id ?? undefined,
                hasOverrides: variant.hasOverrides ?? false,
                sku: variant.sku ?? "",
                barcode: variant.barcode ?? "",
              }))
            : [createEmptyExplicitVariant()]
          : [];

      const attributes = payload.attributes ?? {};
      const materials =
        attributes.materials?.map((material: any) => ({
          materialId:
            material.brand_material_id ?? material.material_id ?? material.materialId,
          percentage:
            typeof material.percentage === "string"
              ? Number(material.percentage)
              : material.percentage,
        })) ?? [];

      // Group journey rows by (sortIndex, stepType) and aggregate operator_ids
      // The database stores one row per operator, so we need to re-group them
      const journeySteps = (() => {
        const rawJourney = attributes.journey ?? [];
        const grouped = new Map<
          string,
          { sortIndex: number; stepType: string; operatorIds: string[] }
        >();

        for (const step of rawJourney) {
          const sortIndex = step.sort_index ?? step.sortIndex ?? 0;
          const stepType = step.step_type ?? step.stepType ?? "";
          const key = `${sortIndex}|${stepType}`;

          // Get operator ID from any of the possible field names
          const operatorId = step.operator_id ?? step.operatorId ?? null;

          if (!grouped.has(key)) {
            grouped.set(key, { sortIndex, stepType, operatorIds: [] });
          }

          if (operatorId) {
            grouped.get(key)!.operatorIds.push(operatorId);
          }
        }

        // Sort by sortIndex and return as array
        return Array.from(grouped.values()).sort(
          (a, b) => a.sortIndex - b.sortIndex,
        );
      })();

      const tagIds =
        attributes.tags
          ?.map((tag: any) => tag.tag_id ?? tag.tagId)
          .filter(Boolean) ?? [];
      const environment = attributes.environment ?? {};
      const weight = attributes.weight ?? {};

      return {
        ...initialFormValues,
        name: payload.name ?? "",
        productHandle: payload.productHandle ?? payload.product_handle ?? "",
        description: payload.description ?? "",
        imageFile: null,
        existingImageUrl: payload.imagePath ?? payload.image_path ?? null,
        categoryId: payload.categoryId ?? payload.category_id ?? null,
        seasonId: payload.seasonId ?? payload.season_id ?? null,
        manufacturerId:
          payload.manufacturerId ?? payload.manufacturer_id ?? null,
        tagIds,
        variantDimensions,
        variantMetadata: metadata,
        explicitVariants,
        enabledVariantKeys,
        materialData: materials,
        journeySteps,
        carbonKgCo2e: stripTrailingZeros(
          environment.carbonKgCo2e ?? environment.carbon_kg_co2e ?? "",
        ),
        waterLiters: stripTrailingZeros(
          environment.waterLiters ?? environment.water_liters ?? "",
        ),
        weightGrams: stripTrailingZeros(weight.weight ?? ""),
        status: payload.status ?? "unpublished",
      };
    },
    [],
  );

  /**
   * Applies fetched product data to local form state and refreshes the saved snapshot.
   */
  const applyHydratedPayload = React.useCallback(
    (payload: any, dataVersion: string | null) => {
      const nextValues = buildHydratedValuesFromPayload(payload);

      setFields(nextValues);
      hydratedValuesRef.current = nextValues;
      metadataRef.current = {
        productId: payload.id,
        productHandle: payload.product_handle ?? productHandle ?? undefined,
      };
      setInitialSnapshot(JSON.stringify(computeComparableState(nextValues)));
      setHasAttemptedSubmit(false);

      // Set database publishing state
      const status = payload.status as "published" | "unpublished" | undefined;
      setDbPublishingStatus(status ?? "unpublished");

      hasHydratedRef.current = true;
      lastHydratedDataVersionRef.current = dataVersion;
    },
    [
      buildHydratedValuesFromPayload,
      computeComparableState,
      productHandle,
      setFields,
    ],
  );

  // Hydrate form from API data
  React.useEffect(() => {
    if (!passportFormQuery.error) return;
    toast.error(
      passportFormQuery.error.message ?? "Failed to load passport data",
    );
  }, [passportFormQuery.error]);

  React.useEffect(() => {
    // Skip if not edit mode, no data, or data hasn't changed since last hydration
    if (!isEditMode || !passportFormQuery.data) return;

    // If already hydrated with this exact data version, skip
    if (
      hasHydratedRef.current &&
      lastHydratedDataVersionRef.current === currentDataVersion
    ) {
      return;
    }

    applyHydratedPayload(passportFormQuery.data, currentDataVersion);
  }, [
    applyHydratedPayload,
    computeComparableState,
    isEditMode,
    passportFormQuery.data,
    currentDataVersion,
  ]);

  React.useEffect(() => {
    if (isEditMode || initialSnapshot !== null) return;
    setInitialSnapshot(JSON.stringify(computeComparableState(formValues)));
  }, [computeComparableState, formValues, initialSnapshot, isEditMode]);

  const serializedState = React.useMemo(
    () => JSON.stringify(computeComparableState(formValues)),
    [computeComparableState, formValues],
  );
  const hasUnsavedChanges =
    initialSnapshot !== null && serializedState !== initialSnapshot;

  const validate = React.useCallback((): PassportFormValidationErrors => {
    setHasAttemptedSubmit(true);
    const errors = getPassportValidationErrors(formValues);
    const variantError = getVariantStructureError(formValues);
    if (variantError) {
      errors.variants = variantError;
    }
    setValidationErrors(errors);
    return errors;
  }, [formValues]);

  type ResolvedVariantDimensionsResult = {
    dimensions: Array<{ attribute_id: string; value_ids: string[] }>;
    /**
     * Per-dimension mapping from the UI token used in variant keys
     * (brand value id or raw string) to the resolved brand attribute value id.
     * This lets us translate `variantMetadata` keys into the server-expected
     * pipe-joined brand value IDs.
     */
    tokenMaps: Array<Map<string, string>>;
  };

  function translateVariantMetadataKeys(
    tokenMaps: ResolvedVariantDimensionsResult["tokenMaps"],
    metadata: Record<string, VariantMetadata>,
  ): Record<string, VariantMetadata> {
    if (!metadata || Object.keys(metadata).length === 0) return {};
    if (tokenMaps.length === 0) return {};

    const next: Record<string, VariantMetadata> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const tokens = key.split("|");
      if (tokens.length !== tokenMaps.length) continue;

      const resolved = tokens.map((t, idx) => tokenMaps[idx]?.get(t) ?? null);
      if (resolved.some((v) => !v)) continue;

      const newKey = (resolved as string[]).join("|");
      next[newKey] = value;
    }

    return next;
  }

  // Resolve variant dimensions - creates brand attributes and values as needed
  const resolveVariantDimensions =
    React.useCallback(async (): Promise<ResolvedVariantDimensionsResult> => {
      // Filter to dimensions that have values (either standard or custom inline)
      const dims = formValues.variantDimensions.filter((d) => {
        if (d.isCustomInline) {
          return (d.customValues ?? []).some((v) => v.trim().length > 0);
        }
        return d.values.length > 0;
      });
      if (dims.length === 0) return { dimensions: [], tokenMaps: [] };

      const brandCatalogQuery = queryClient.getQueryData(
        trpc.composite.catalogContent.queryKey(),
      ) as any;
      // Copy to mutable working lists so we can include newly-created attrs/values
      // in subsequent lookups within the same submit.
      const existingBrandAttrs: any[] = [
        ...(brandCatalogQuery?.brandCatalog?.attributes ?? []),
      ];
      const existingBrandValues: any[] = [
        ...(brandCatalogQuery?.brandCatalog?.attributeValues ?? []),
      ];

      const resolved: Array<{ attribute_id: string; value_ids: string[] }> = [];
      const tokenMaps: Array<Map<string, string>> = [];

      for (const dim of dims) {
        let brandAttrId = dim.attributeId;
        const tokenToBrandValueId = new Map<string, string>();

        // Handle custom inline attributes - create the attribute first
        if (dim.isCustomInline) {
          const attrName = dim.customAttributeName?.trim();
          if (!attrName) continue;

          // Check if attribute with this name already exists
          const existing = existingBrandAttrs.find(
            (a: any) => a.name.toLowerCase() === attrName.toLowerCase(),
          );
          if (existing) {
            brandAttrId = existing.id;
          } else {
            const result = await createAttributeMutation.mutateAsync({
              name: attrName,
            });
            if (!result?.data?.id)
              throw new Error("Failed to create custom attribute");
            brandAttrId = result.data.id;
            existingBrandAttrs.push(result.data);
          }

          // Create values for custom inline
          const resolvedValueIds: string[] = [];
          for (const valueName of dim.customValues ?? []) {
            const trimmedName = valueName.trim();
            if (!trimmedName) continue;

            // Check if value exists
            const existingValue = existingBrandValues.find(
              (v: any) =>
                v.attributeId === brandAttrId &&
                v.name.toLowerCase() === trimmedName.toLowerCase(),
            );
            if (existingValue) {
              resolvedValueIds.push(existingValue.id);
              tokenToBrandValueId.set(trimmedName, existingValue.id);
              tokenToBrandValueId.set(existingValue.id, existingValue.id);
            } else {
              const result = await createAttributeValueMutation.mutateAsync({
                attribute_id: brandAttrId!,
                name: trimmedName,
              });
              if (!result?.data?.id)
                throw new Error("Failed to create custom attribute value");
              resolvedValueIds.push(result.data.id);
              tokenToBrandValueId.set(trimmedName, result.data.id);
              tokenToBrandValueId.set(result.data.id, result.data.id);
              existingBrandValues.push(result.data);
            }
          }

          if (resolvedValueIds.length > 0) {
            resolved.push({
              attribute_id: brandAttrId!,
              value_ids: resolvedValueIds,
            });
            tokenMaps.push(tokenToBrandValueId);
          }
          continue;
        }

        if (!brandAttrId) continue;

        // Resolve values
        const resolvedValueIds: string[] = [];
        for (const valueId of dim.values) {
          const existingBrandValue = existingBrandValues.find(
            (v: any) => v.id === valueId && v.attributeId === brandAttrId,
          );

          if (existingBrandValue) {
            resolvedValueIds.push(existingBrandValue.id);
            tokenToBrandValueId.set(valueId, existingBrandValue.id);
            tokenToBrandValueId.set(
              existingBrandValue.name,
              existingBrandValue.id,
            );
            continue;
          }

          // Legacy fallback: some UI states may still hold raw value names.
          const existingByName = existingBrandValues.find(
            (v: any) => v.attributeId === brandAttrId && v.name === valueId,
          );
          if (existingByName) {
            resolvedValueIds.push(existingByName.id);
            tokenToBrandValueId.set(valueId, existingByName.id);
            tokenToBrandValueId.set(existingByName.id, existingByName.id);
            continue;
          }

          const result = await createAttributeValueMutation.mutateAsync({
            attribute_id: brandAttrId,
            name: valueId,
          });
          if (!result?.data?.id)
            throw new Error("Failed to create attribute value");
          resolvedValueIds.push(result.data.id);
          tokenToBrandValueId.set(valueId, result.data.id);
          tokenToBrandValueId.set(result.data.id, result.data.id);
          existingBrandValues.push(result.data);
        }

        resolved.push({
          attribute_id: brandAttrId,
          value_ids: resolvedValueIds,
        });
        tokenMaps.push(tokenToBrandValueId);
      }

      // Note: We intentionally don't invalidate the catalog cache here.
      // The submit function handles cache updates synchronously via await refetchQueries
      // to prevent UI flashes during the save process.
      return { dimensions: resolved, tokenMaps };
    }, [
      formValues.variantDimensions,
      createAttributeMutation,
      createAttributeValueMutation,
      queryClient,
      trpc,
    ]);

  const submit = React.useCallback(
    async (brandId: string) => {
      setIsSubmitting(true);
      setError(null);
      setHasAttemptedSubmit(true);

      const errors = validate();
      if (!isFormValid(errors)) {
        setIsSubmitting(false);
        throw new Error("Form validation failed");
      }

      try {
        const name = formValues.name.trim();
        if (!name) throw new Error("Name is required");

        const productHandle = formValues.productHandle.trim() || undefined;

        let imagePath: string | undefined;
        if (formValues.imageFile) {
          const path = buildPath([brandId.trim()], formValues.imageFile);
          const result = await uploadImage({
            file: formValues.imageFile,
            path,
            bucket: "products",
            metadata: { brand_id: brandId.trim() },
            isPublic: true,
            validation: {
              maxBytes: 10 * 1024 * 1024,
              allowedMime: [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
                "image/avif",
              ],
            },
          });
          imagePath = result.storageUrl;
        }

        // Resolve variant dimensions (creates brand attributes/values as needed)
        const resolvedVariant = await resolveVariantDimensions();
        const resolvedDimensions = resolvedVariant.dimensions;
        const variantMetadataForUpsert =
          resolvedDimensions.length > 0
            ? translateVariantMetadataKeys(
                resolvedVariant.tokenMaps,
                formValues.variantMetadata,
              )
            : undefined;

        const materials =
          formValues.materialData.length > 0
            ? formValues.materialData.map((m) => ({
                brand_material_id: m.materialId,
                percentage: m.percentage,
              }))
            : undefined;
        // Always send tagIds - empty array clears tags, undefined skips update
        const tagIds = formValues.tagIds;
        const journeySteps =
          formValues.journeySteps.length > 0
            ? formValues.journeySteps.map((s) => ({
                sort_index: s.sortIndex,
                step_type: s.stepType,
                operator_ids: s.operatorIds,
              }))
            : undefined;
        const environmentPayload =
          formValues.carbonKgCo2e.trim() || formValues.waterLiters.trim()
            ? {
                carbon_kg_co2e: formValues.carbonKgCo2e.trim() || undefined,
                water_liters: formValues.waterLiters.trim() || undefined,
              }
            : undefined;
        const weightPayload = formValues.weightGrams.trim()
          ? {
              weight: formValues.weightGrams.trim(),
              weight_unit: "g",
            }
          : undefined;

        const basePayload = {
          brand_id: brandId,
          name,
          product_handle: productHandle,
          description: formValues.description.trim() || undefined,
          category_id: formValues.categoryId ?? undefined,
          season_id: formValues.seasonId ?? undefined, // Convert null to undefined for create (schema expects optional, not nullable)
          manufacturer_id: formValues.manufacturerId || undefined,
          image_path: imagePath ?? formValues.existingImageUrl ?? undefined,
          status: (formValues.status || "unpublished") as
            | "published"
            | "unpublished",
          materials,
          tag_ids: tagIds,
          journey_steps: journeySteps,
          environment: environmentPayload,
          weight: weightPayload,
        };

        if (isEditMode) {
          const effectiveProductHandle =
            productHandle ?? metadataRef.current.productHandle ?? null;
          if (!metadataRef.current.productId || !effectiveProductHandle) {
            throw new Error("Unable to update passport: missing context");
          }

          await updateProductMutation.mutateAsync({
            ...basePayload,
            id: metadataRef.current.productId,
          });

          // Sync variants using the new sync endpoint
          if (resolvedDimensions.length > 0) {
            // Build variants for sync from enabled keys
            const variantsForSync: Array<{
              upid?: string;
              attributeValueIds: string[];
              sku?: string;
              barcode?: string;
            }> = [];

            for (const key of formValues.enabledVariantKeys) {
              const tokens = key.split("|");

              // Skip keys that don't match the current dimension count
              if (tokens.length !== resolvedDimensions.length) {
                continue;
              }

              // Translate UI tokens to resolved brand value IDs using tokenMaps
              const resolvedValueIds = tokens
                .map((token, idx) => resolvedVariant.tokenMaps[idx]?.get(token))
                .filter((id): id is string => id !== undefined);

              // Only include if all values resolved
              if (resolvedValueIds.length === tokens.length) {
                const resolvedKey = resolvedValueIds.join("|");
                const metadata = variantMetadataForUpsert?.[resolvedKey];
                // Look up UPID from savedVariantsMap first, then check expandedVariantMappings
                // (which holds mappings when dimensions are added/removed)
                const savedVariant = savedVariantsMap.get(resolvedKey);
                const expandedMapping =
                  formValues.expandedVariantMappings.get(resolvedKey);

                variantsForSync.push({
                  upid: savedVariant?.upid ?? expandedMapping?.upid,
                  attributeValueIds: resolvedValueIds,
                  sku: metadata?.sku || undefined,
                  barcode: metadata?.barcode || undefined,
                });
              }
            }

            if (variantsForSync.length > 0) {
              await syncVariantsMutation.mutateAsync({
                productHandle: effectiveProductHandle,
                variants: variantsForSync,
              });
            }
          } else {
            const explicitVariantsForSync =
              formValues.explicitVariants.length > 0
                ? formValues.explicitVariants
                : [createEmptyExplicitVariant()];

            await syncVariantsMutation.mutateAsync({
              productHandle: effectiveProductHandle,
              variants: explicitVariantsForSync.map((variant) => ({
                upid: variant.upid || undefined,
                attributeValueIds: [],
                sku: variant.sku || undefined,
                barcode: variant.barcode || undefined,
              })),
            });
          }

          // EXPLICIT PUBLISH: After all data changes are saved, trigger publish if product is published.
          // This is the ONLY place where publish is called during save - keeps logic simple and predictable.
          // The content hash deduplication in publishVariant will skip creating versions if nothing changed.
          const currentStatus = formValues.status ?? dbPublishingStatus;
          if (currentStatus === "published" && metadataRef.current.productId) {
            await publishProductMutation.mutateAsync({
              productId: metadataRef.current.productId,
            });
          }

          // Refresh both the saved product payload and brand catalog before
          // rebuilding local form state from the canonical server response.
          const productQueryOptions = trpc.products.get.queryOptions({
            handle: effectiveProductHandle,
            includeVariants: true,
            includeAttributes: true,
          });

          // This page is keyed by the handle-based product query, so invalidate
          // and refetch that exact cache entry before rebuilding local state.
          await queryClient.invalidateQueries({
            queryKey: productQueryOptions.queryKey,
            exact: true,
          });

          const [refreshedProduct] = await Promise.all([
            queryClient.fetchQuery({
              ...productQueryOptions,
              staleTime: 0,
            }),
            queryClient.refetchQueries({
              queryKey: trpc.composite.catalogContent.queryKey(),
            }),
          ]);

          applyHydratedPayload(
            refreshedProduct,
            buildProductDataVersion(refreshedProduct),
          );
          setValidationErrors({});

          // Invalidate other queries in the background (fire-and-forget)
          void queryClient.invalidateQueries({
            queryKey: trpc.products.get.queryKey({
              id: metadataRef.current.productId,
            }),
          });
          void queryClient.invalidateQueries({
            queryKey: productQueryOptions.queryKey,
            exact: true,
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.products.list.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.summary.productStatus.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.brand.billing.getStatus.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.composite.initDashboard.queryKey(),
          });

          toast.success("Passport updated successfully");
          return;
        }

        // Create mode
        const created = await createProductMutation.mutateAsync({
          ...basePayload,
          status:
            basePayload.status === "published"
              ? "unpublished"
              : basePayload.status,
        });
        const productId = created?.data?.id;
        const targetProductHandle =
          (created as any)?.data?.product_handle ?? productHandle ?? null;
        if (!productId) throw new Error("Product was not created");

        // Sync variants using the new sync endpoint
        if (resolvedDimensions.length > 0) {
          // Build variants for sync from enabled keys
          const variantsForSync: Array<{
            attributeValueIds: string[];
            sku?: string;
            barcode?: string;
          }> = [];

          for (const key of formValues.enabledVariantKeys) {
            const tokens = key.split("|");

            // Skip keys that don't match the current dimension count
            if (tokens.length !== resolvedDimensions.length) {
              continue;
            }

            // Translate UI tokens to resolved brand value IDs using tokenMaps
            const resolvedValueIds = tokens
              .map((token, idx) => resolvedVariant.tokenMaps[idx]?.get(token))
              .filter((id): id is string => id !== undefined);

            // Only include if all values resolved
            if (resolvedValueIds.length === tokens.length) {
              const metadata =
                variantMetadataForUpsert?.[resolvedValueIds.join("|")];
              variantsForSync.push({
                attributeValueIds: resolvedValueIds,
                sku: metadata?.sku || undefined,
                barcode: metadata?.barcode || undefined,
              });
            }
          }

          if (variantsForSync.length > 0 && targetProductHandle) {
            await syncVariantsMutation.mutateAsync({
              productHandle: targetProductHandle,
              variants: variantsForSync,
            });
          }
        } else if (targetProductHandle) {
          const explicitVariantsForSync =
            formValues.explicitVariants.length > 0
              ? formValues.explicitVariants
              : [createEmptyExplicitVariant()];

          await syncVariantsMutation.mutateAsync({
            productHandle: targetProductHandle,
            variants: explicitVariantsForSync.map((variant) => ({
              attributeValueIds: [],
              sku: variant.sku || undefined,
              barcode: variant.barcode || undefined,
            })),
          });
        }

        // Keep published create flows aligned with edit flows by materializing the snapshot immediately.
        if (
          (formValues.status ?? "unpublished") === "published" &&
          productId &&
          targetProductHandle
        ) {
          await publishProductMutation.mutateAsync({
            productId,
          });
        }

        // Cache seeding: Fetch the complete product and seed the cache before navigation.
        // This ensures the edit page renders instantly without showing loading skeletons.
        // Best-effort: if this fails, navigation still proceeds (edit page will fetch data itself).
        if (targetProductHandle) {
          try {
            const fullProductData = await queryClient.fetchQuery(
              trpc.products.get.queryOptions({
                handle: targetProductHandle,
                includeVariants: true,
                includeAttributes: true,
              }),
            );

            // Seed the cache with the fetched data - edit page will find it instantly
            queryClient.setQueryData(
              trpc.products.get.queryKey({
                handle: targetProductHandle,
                includeVariants: true,
                includeAttributes: true,
              }),
              fullProductData,
            );
          } catch (cacheError) {
            // Cache seeding failed - not critical, edit page will fetch data normally
            console.warn("Cache seeding failed:", cacheError);
          }

          // Navigate immediately for seamless transition
          router.push(`/passports/edit/${targetProductHandle}`);
          toast.success("Passport created successfully");
        } else {
          router.push("/passports");
          toast.success("Passport created successfully");
        }

        // Invalidate other caches in background (fire-and-forget)
        void Promise.allSettled([
          queryClient.invalidateQueries({
            queryKey: trpc.products.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.catalogContent.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.products.get.queryKey({ id: productId }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.summary.productStatus.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.brand.billing.getStatus.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.initDashboard.queryKey(),
          }),
        ]);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create passport";
        setError(errorMessage);
        toast.error(errorMessage);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      computeComparableState,
      applyHydratedPayload,
      formValues,
      isEditMode,
      queryClient,
      router,
      trpc,
      uploadImage,
      validate,
      resolveVariantDimensions,
      createProductMutation,
      updateProductMutation,
      syncVariantsMutation,
      buildPath,
      resetFormValues,
      savedVariantsMap,
    ],
  );

  // Helper: Generate all combinations of k indices from 0 to n-1
  // Used to check all possible ways to reduce an enabled key to a saved key
  const generateIndexCombinations = (n: number, k: number): number[][] => {
    if (k === 0) return [[]];
    if (k > n) return [];

    const result: number[][] = [];
    const combine = (start: number, combo: number[]) => {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < n; i++) {
        combo.push(i);
        combine(i + 1, combo);
        combo.pop();
      }
    };
    combine(0, []);
    return result;
  };

  // Detect variants that would be deleted on save (exist in DB but not in enabledVariantKeys)
  const getVariantsToDelete = React.useCallback(() => {
    if (!isEditMode || savedVariantsMap.size === 0) return [];

    const variantsToDelete: Array<{
      upid: string;
      attributeSummary: string;
      sku?: string;
      barcode?: string;
    }> = [];

    // Get dimension counts to detect expansion scenarios
    const enabledKeysArray = [...formValues.enabledVariantKeys];
    const firstEnabledKey = enabledKeysArray[0];
    const enabledDimCount = firstEnabledKey
      ? firstEnabledKey.split("|").length
      : 0;

    // Check each saved variant to see if it's still in enabledVariantKeys
    for (const [key, variantInfo] of savedVariantsMap) {
      // Direct match - variant still exists with same key
      if (formValues.enabledVariantKeys.has(key)) {
        continue;
      }

      const savedParts = key.split("|");
      const savedDimCount = savedParts.length;

      // If the form has MORE dimensions than saved data, check if this variant
      // was "expanded" rather than deleted. This happens when adding a new
      // attribute dimension - existing variants get the first value of the new
      // dimension added to their key.
      if (enabledDimCount > savedDimCount) {
        let isExpanded = false;
        const segmentsToRemove = enabledDimCount - savedDimCount;

        // Check if any enabled key, when the extra segments are removed, matches the saved key.
        // The new dimension values could be inserted at any positions, so we need to try
        // all combinations of segment removal.
        for (const enabledKey of enabledKeysArray) {
          const enabledParts = enabledKey.split("|");

          // Only consider keys with the correct number of segments
          if (enabledParts.length !== enabledDimCount) continue;

          // Generate all combinations of indices to remove
          const indicesToRemove = generateIndexCombinations(
            enabledParts.length,
            segmentsToRemove,
          );

          for (const indices of indicesToRemove) {
            const reducedParts = enabledParts.filter(
              (_, idx) => !indices.includes(idx),
            );
            if (reducedParts.join("|") === key) {
              isExpanded = true;
              break;
            }
          }

          if (isExpanded) break;
        }

        if (isExpanded) {
          // Variant was expanded with new dimension value, not deleted
          continue;
        }
      }

      // This variant will be deleted - use data from savedVariantsMap
      // which stores the original API response data including attribute labels
      variantsToDelete.push({
        upid: variantInfo.upid,
        attributeSummary: variantInfo.attributeLabel,
        sku: variantInfo.sku ?? undefined,
        barcode: variantInfo.barcode ?? undefined,
      });
    }

    return variantsToDelete;
  }, [isEditMode, savedVariantsMap, formValues.enabledVariantKeys]);

  /**
   * Revert the form to its last saved/hydrated state.
   * Used when discarding unsaved changes - restores form to the original
   * fetched data rather than resetting to empty initial values.
   */
  const revertToSaved = React.useCallback(() => {
    if (isEditMode && hydratedValuesRef.current) {
      // Restore form to the last hydrated values from the server
      setFields(hydratedValuesRef.current);
      setValidationErrors({});
      setHasAttemptedSubmit(false);
      // Reset the snapshot to match the reverted values
      setInitialSnapshot(
        JSON.stringify(computeComparableState(hydratedValuesRef.current)),
      );
    } else {
      // For create mode, just reset to initial empty values
      resetFormValues();
      setValidationErrors({});
      setHasAttemptedSubmit(false);
      setInitialSnapshot(null);
    }
  }, [isEditMode, setFields, resetFormValues, computeComparableState]);

  // Compute barcode validation errors for disabling save button
  const hasBarcodeErrors = React.useMemo(
    () =>
      computeHasBarcodeErrors(
        formValues.variantMetadata,
        formValues.explicitVariants,
        formValues.enabledVariantKeys,
      ),
    [
      formValues.variantMetadata,
      formValues.explicitVariants,
      formValues.enabledVariantKeys,
    ],
  );

  return {
    state,
    setField,
    updateField,
    resetForm: resetFormValues,
    revertToSaved,
    clearValidationError,
    validate,
    submit,
    isSubmitting,
    error,
    isInitializing:
      isEditMode && (!hasHydratedRef.current || passportFormQuery.isLoading),
    hasUnsavedChanges,
    // Barcode validation
    hasBarcodeErrors,
    // Navigation support for variant editing
    savedVariantsMap,
    productHandle,
    // Publishing support
    productId: metadataRef.current.productId ?? null,
    dbPublishingStatus,
    // Variant deletion detection
    getVariantsToDelete,
  };
}
