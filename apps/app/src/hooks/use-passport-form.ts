import { useTRPC } from "@/trpc/client";
import { useFormState } from "@/hooks/use-form-state";
import { useImageUpload } from "@/hooks/use-upload";
import {
  rules,
  validateForm,
  type ValidationErrors,
  type ValidationSchema,
  isFormValid,
} from "@/hooks/use-form-validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import { useRouter } from "next/navigation";
import * as React from "react";
import type {
  VariantDimension,
  VariantMetadata,
} from "@/components/forms/passport/blocks/variant-block";

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
  explicitVariants: Array<{ sku: string; barcode: string }>;
  /**
   * Tracks which variant combinations are enabled (exist).
   * Keys are pipe-separated value IDs, e.g., "red-value-id|S-value-id".
   * This allows heterogeneous variants where not all combinations from the
   * cartesian product need to exist.
   */
  enabledVariantKeys: Set<string>;

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
  explicitVariants: [],
  enabledVariantKeys: new Set<string>(),
  materialData: [],
  journeySteps: [],
  carbonKgCo2e: "",
  waterLiters: "",
  weightGrams: "",
  status: "unpublished",
};

// ============================================================================
// Validation
// ============================================================================

export interface PassportFormValidationErrors {
  name?: string;
  productHandle?: string;
  description?: string;
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
    rules.maxLength(1000, "Description must be 1000 characters or less"),
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

      let total = 0;
      for (const material of materials) {
        if (!material.materialId || material.materialId.startsWith("temp-")) {
          return "All materials must be selected";
        }
        if (material.percentage < 0 || material.percentage > 100) {
          return "Material percentages must be between 0 and 100";
        }
        total += material.percentage;
      }

      if (total > 100) {
        return `Material percentages sum to ${total.toFixed(1)}%, but cannot exceed 100%`;
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

function stripTrailingZeros(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value);
  if (str.includes(".")) return str.replace(/\.?0+$/, "");
  return str;
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
    if (!passportFormQuery.data) return null;
    const data = passportFormQuery.data as any;
    // Use a combination of fields that would change when the product is modified
    // Include status and updated_at to catch external changes (e.g., status toggle from list view)
    const variants = data.variants ?? [];
    const variantKeys = variants
      .map((v: any) => v.upid || v.id)
      .sort()
      .join(",");
    const status = data.status ?? "unpublished";
    const updatedAt = data.updated_at ?? data.updatedAt ?? "";
    return `${data.id}:${status}:${updatedAt}:${variants.length}:${variantKeys}`;
  }, [passportFormQuery.data]);

  const state: PassportFormState = React.useMemo(
    () => ({ ...formValues, validationErrors, hasAttemptedSubmit }),
    [formValues, validationErrors, hasAttemptedSubmit],
  );

  // Compute a map of variant value keys -> variant info for navigation in edit mode
  // The key is pipe-separated value IDs matching the format used in variantMetadata
  // Includes all variant data needed for delete warnings and navigation
  // Track the ghost variant (system-created default variant) separately.
  // This is used to preserve the UPID when transitioning from 0 to 1 attribute value.
  const defaultVariantUpid = React.useMemo(() => {
    if (!isEditMode || !passportFormQuery.data) return null;

    const payload = passportFormQuery.data as any;
    const variants = Array.isArray(payload?.variants) ? payload.variants : [];

    // Find the ghost variant using the explicit isGhost flag
    for (const variant of variants) {
      const upid = variant.upid ?? variant.unique_product_id;
      if (!upid) continue;

      // Use explicit isGhost flag to identify ghost variants
      if (variant.isGhost) {
        return upid;
      }
    }

    return null;
  }, [isEditMode, passportFormQuery.data]);

  const savedVariantsMap = React.useMemo(() => {
    if (!isEditMode || !passportFormQuery.data)
      return new Map<
        string,
        {
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
        upid: string;
        hasOverrides: boolean;
        sku: string | null;
        barcode: string | null;
        attributeLabel: string;
      }
    >();

    for (const variant of variants) {
      const upid = variant.upid ?? variant.unique_product_id;
      if (!upid) continue;

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

    const payload = passportFormQuery.data as any;
    const variants = Array.isArray(payload?.variants) ? payload.variants : [];

    // Build dimensions and metadata from variant attributes
    // Store brand attribute value IDs so custom names (e.g. "Sky Blue") rehydrate correctly
    const dimensionMap = new Map<
      string,
      {
        attributeId: string;
        name: string;
        taxonomyAttributeId: string | null;
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
        const attrName = attr.attribute_name ?? attr.attributeName ?? "Unknown";
        const taxAttrId =
          attr.taxonomy_attribute_id ?? attr.taxonomyAttributeId ?? null;

        if (attrId && brandValueId) {
          if (!dimensionMap.has(attrId)) {
            dimensionMap.set(attrId, {
              attributeId: attrId,
              name: attrName,
              taxonomyAttributeId: taxAttrId,
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
    ).map((d, idx) => ({
      id: `dim-${idx}`,
      attributeId: d.attributeId,
      attributeName: d.name,
      taxonomyAttributeId: d.taxonomyAttributeId,
      values: Array.from(d.values),
    }));

    // Compute enabled variant keys from actual existing variants
    // This allows heterogeneous products where not all combinations exist
    const enabledVariantKeys = new Set<string>();
    for (const variant of variants) {
      const attrs = variant.attributes ?? [];
      const valueKeys = attrs
        .map((a: any) => a.value_id ?? a.valueId)
        .filter(Boolean);
      if (valueKeys.length > 0) {
        enabledVariantKeys.add(valueKeys.join("|"));
      }
    }

    // Handle explicit variants (no attributes)
    // Filter out ghost variants using the explicit isGhost flag.
    // Ghost variants exist in the database for publishing purposes but should be invisible to users.
    const explicitVariants: Array<{ sku: string; barcode: string }> = [];
    if (variantDimensions.length === 0 && variants.length > 0) {
      for (const v of variants) {
        // Use explicit isGhost flag instead of heuristic
        if (!v.isGhost) {
          explicitVariants.push({ sku: v.sku ?? "", barcode: v.barcode ?? "" });
        }
      }
    }

    const attributes = payload.attributes ?? {};
    const materials =
      attributes.materials?.map((m: any) => ({
        materialId: m.brand_material_id ?? m.material_id ?? m.materialId,
        percentage:
          typeof m.percentage === "string"
            ? Number(m.percentage)
            : m.percentage,
      })) ?? [];
    // Group journey rows by (sortIndex, stepType) and aggregate operator_ids
    // The database stores one row per operator, so we need to re-group them
    const journeySteps = (() => {
      const rawJourney = attributes.journey ?? [];
      const grouped = new Map<
        string,
        { sortIndex: number; stepType: string; operatorIds: string[] }
      >();

      for (const s of rawJourney) {
        const sortIndex = s.sort_index ?? s.sortIndex ?? 0;
        const stepType = s.step_type ?? s.stepType ?? "";
        const key = `${sortIndex}|${stepType}`;

        // Get operator ID from any of the possible field names
        const operatorId = s.operator_id ?? s.operatorId ?? null;

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
      attributes.tags?.map((t: any) => t.tag_id ?? t.tagId).filter(Boolean) ??
      [];
    const environment = attributes.environment ?? {};
    const weight = attributes.weight ?? {};

    const nextValues: PassportFormValues = {
      ...initialFormValues,
      name: payload.name ?? "",
      productHandle: payload.productHandle ?? payload.product_handle ?? "",
      description: payload.description ?? "",
      imageFile: null,
      existingImageUrl: payload.imagePath ?? payload.image_path ?? null,
      categoryId: payload.categoryId ?? payload.category_id ?? null,
      seasonId: payload.seasonId ?? payload.season_id ?? null,
      manufacturerId: payload.manufacturerId ?? payload.manufacturer_id ?? null,
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

    setFields(nextValues);
    // Store the hydrated values so we can revert to them when discarding changes
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
    lastHydratedDataVersionRef.current = currentDataVersion;
  }, [
    computeComparableState,
    isEditMode,
    passportFormQuery.data,
    setFields,
    productHandle,
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
    const errors = getPassportValidationErrors(formValues);
    setValidationErrors(errors);
    return errors;
  }, [formValues]);

  type ResolvedVariantDimensionsResult = {
    dimensions: Array<{ attribute_id: string; value_ids: string[] }>;
    /**
     * Per-dimension mapping from the UI token used in variant keys (taxonomy value id,
     * brand value id, or raw string) to the resolved brand attribute value id.
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
            (a: any) =>
              a.name.toLowerCase() === attrName.toLowerCase() &&
              !a.taxonomyAttributeId,
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

        // Create brand attribute if it doesn't exist (indicated by tax: prefix)
        if (brandAttrId?.startsWith("tax:")) {
          const taxAttrId = brandAttrId.slice(4);
          const existing = existingBrandAttrs.find(
            (a: any) => a.taxonomyAttributeId === taxAttrId,
          );
          if (existing) {
            brandAttrId = existing.id;
          } else {
            const result = await createAttributeMutation.mutateAsync({
              name: dim.attributeName,
              taxonomy_attribute_id: taxAttrId,
            });
            if (!result?.data?.id)
              throw new Error("Failed to create attribute");
            brandAttrId = result.data.id;
            existingBrandAttrs.push(result.data);
          }
        }

        if (!brandAttrId) continue;

        // Resolve values
        const resolvedValueIds: string[] = [];

        if (dim.taxonomyAttributeId) {
          // Taxonomy-linked: values can be brand value IDs or tax:-prefixed taxonomy value IDs
          for (const valueId of dim.values) {
            // Check if this is a tax:-prefixed pending taxonomy value
            const isTaxPrefixed = valueId.startsWith("tax:");
            const actualValueId = isTaxPrefixed ? valueId.slice(4) : valueId;

            // First, check if it's already a brand value ID
            const existingBrandValue = existingBrandValues.find(
              (v: any) =>
                v.id === actualValueId && v.attributeId === brandAttrId,
            );

            if (existingBrandValue) {
              resolvedValueIds.push(existingBrandValue.id);
              tokenToBrandValueId.set(valueId, existingBrandValue.id);
              tokenToBrandValueId.set(actualValueId, existingBrandValue.id);
              tokenToBrandValueId.set(
                existingBrandValue.name,
                existingBrandValue.id,
              );
            } else {
              // Check if there's already a brand value linked to this taxonomy value
              const existingByTaxonomy = existingBrandValues.find(
                (v: any) =>
                  v.attributeId === brandAttrId &&
                  v.taxonomyValueId === actualValueId,
              );
              if (existingByTaxonomy) {
                resolvedValueIds.push(existingByTaxonomy.id);
                tokenToBrandValueId.set(valueId, existingByTaxonomy.id);
                tokenToBrandValueId.set(actualValueId, existingByTaxonomy.id);
                tokenToBrandValueId.set(
                  existingByTaxonomy.name,
                  existingByTaxonomy.id,
                );
                tokenToBrandValueId.set(
                  existingByTaxonomy.id,
                  existingByTaxonomy.id,
                );
              } else {
                // Look up the taxonomy value to get its name
                const taxValues = brandCatalogQuery?.taxonomy?.values ?? [];
                const taxValue = taxValues.find(
                  (v: any) => v.id === actualValueId,
                );
                const name = taxValue?.name ?? actualValueId;

                // Check if there's already a brand value with the same name for this attribute
                // This handles cases where:
                // - The brand has a "Black" value created via integration (no taxonomy link)
                // - The brand has a "Black" value created via modal without selecting taxonomy
                // - The user now selects "Black" from the taxonomy dropdown
                const existingByName = existingBrandValues.find(
                  (v: any) =>
                    v.attributeId === brandAttrId &&
                    v.name.toLowerCase() === name.toLowerCase(),
                );

                if (existingByName) {
                  // Use existing value found by name - no need to create a duplicate
                  resolvedValueIds.push(existingByName.id);
                  tokenToBrandValueId.set(valueId, existingByName.id);
                  tokenToBrandValueId.set(actualValueId, existingByName.id);
                  tokenToBrandValueId.set(
                    existingByName.name,
                    existingByName.id,
                  );
                  tokenToBrandValueId.set(existingByName.id, existingByName.id);
                } else {
                  // Create brand value for taxonomy value
                  const result = await createAttributeValueMutation.mutateAsync(
                    {
                      attribute_id: brandAttrId,
                      name,
                      taxonomy_value_id: actualValueId,
                    },
                  );
                  if (!result?.data?.id)
                    throw new Error("Failed to create attribute value");
                  resolvedValueIds.push(result.data.id);
                  tokenToBrandValueId.set(valueId, result.data.id);
                  tokenToBrandValueId.set(actualValueId, result.data.id);
                  tokenToBrandValueId.set(
                    result.data.name ?? name,
                    result.data.id,
                  );
                  tokenToBrandValueId.set(result.data.id, result.data.id);
                  existingBrandValues.push(result.data);
                }
              }
            }
          }
        } else {
          // Existing custom attribute: values are brand value IDs (already created via modal)
          for (const valueId of dim.values) {
            // Check if this is already a valid brand value ID
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
            } else {
              // Might be a value name if the attribute was previously custom inline
              const existingByName = existingBrandValues.find(
                (v: any) => v.attributeId === brandAttrId && v.name === valueId,
              );
              if (existingByName) {
                resolvedValueIds.push(existingByName.id);
                tokenToBrandValueId.set(valueId, existingByName.id);
                tokenToBrandValueId.set(existingByName.id, existingByName.id);
              } else {
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
            }
          }
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
              isGhost?: boolean;
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
                const savedVariant = savedVariantsMap.get(resolvedKey);

                variantsForSync.push({
                  upid: savedVariant?.upid,
                  attributeValueIds: resolvedValueIds,
                  sku: metadata?.sku || undefined,
                  barcode: metadata?.barcode || undefined,
                  isGhost: false, // Variants with attributes are always real (non-ghost)
                });
              }
            }

            // If there's exactly one variant being synced without a UPID (new variant), and we have
            // a ghost variant, reuse its UPID. This preserves the UPID when transitioning from 0 to 1
            // attribute value (e.g., adding "Black" to a product that had no color attribute - the
            // ghost variant becomes the "Black" variant and is converted from ghost to real).
            if (
              variantsForSync.length === 1 &&
              !variantsForSync[0]!.upid &&
              defaultVariantUpid
            ) {
              variantsForSync[0]!.upid = defaultVariantUpid;
              variantsForSync[0]!.isGhost = false; // Convert ghost to real
            }

            if (variantsForSync.length > 0) {
              await syncVariantsMutation.mutateAsync({
                productHandle: effectiveProductHandle,
                variants: variantsForSync,
              });
            }
          } else if (formValues.explicitVariants.length > 0) {
            await syncVariantsMutation.mutateAsync({
              productHandle: effectiveProductHandle,
              variants: formValues.explicitVariants.map((v) => ({
                attributeValueIds: [],
                sku: v.sku || undefined,
                barcode: v.barcode || undefined,
                isGhost: false, // Explicit variants are always real (non-ghost)
              })),
            });
          } else {
            // No dimensions and no explicit variants - create/update a ghost variant.
            // Every product must have at least one variant (even without attribute values) to be publishable.
            // This ghost variant will be converted to a real variant if the user later adds attributes.
            // Preserve the existing ghost variant's UPID if it exists to avoid unnecessary recreation.
            await syncVariantsMutation.mutateAsync({
              productHandle: effectiveProductHandle,
              variants: [
                {
                  attributeValueIds: [],
                  upid: defaultVariantUpid ?? undefined,
                  isGhost: true,
                },
              ],
            });
          }

          // EXPLICIT PUBLISH: After all data changes are saved, trigger publish if product is published.
          // This is the ONLY place where publish is called during save - keeps logic simple and predictable.
          // The content hash deduplication in publishVariant will skip creating versions if nothing changed.
          const currentStatus = formValues.status ?? dbPublishingStatus;
          if (
            currentStatus === "published" &&
            metadataRef.current.productId
          ) {
            await publishProductMutation.mutateAsync({
              productId: metadataRef.current.productId,
            });
          }

          // First, refetch the critical queries so savedVariantsMap and brandAttributeValuesByAttribute
          // are updated with fresh data BEFORE we update local state with resolved brand value IDs.
          // This prevents the brief UI flash where all variants show "new" badges.
          await Promise.all([
            queryClient.refetchQueries({
              queryKey: trpc.products.get.queryKey({
                handle: effectiveProductHandle,
              }),
            }),
            queryClient.refetchQueries({
              queryKey: trpc.composite.catalogContent.queryKey(),
            }),
          ]);

          // Now update dimension values to use resolved brand value IDs
          // This replaces tax:-prefixed pending values with actual brand value IDs
          if (resolvedVariant.tokenMaps.length > 0) {
            const updatedDimensions = formValues.variantDimensions.map(
              (dim, dimIndex) => {
                const tokenMap = resolvedVariant.tokenMaps[dimIndex];
                if (!tokenMap || dim.isCustomInline) return dim;

                // Replace values with resolved brand value IDs
                const updatedValues = dim.values.map(
                  (valueId) => tokenMap.get(valueId) ?? valueId,
                );

                return { ...dim, values: updatedValues };
              },
            );

            // Update enabledVariantKeys with resolved brand value IDs
            const updatedEnabledKeys = new Set<string>();
            for (const key of formValues.enabledVariantKeys) {
              const tokens = key.split("|");
              const resolvedTokens = tokens.map((token, idx) => {
                const tokenMap = resolvedVariant.tokenMaps[idx];
                return tokenMap?.get(token) ?? token;
              });
              updatedEnabledKeys.add(resolvedTokens.join("|"));
            }

            // Update variantMetadata keys with resolved brand value IDs
            const updatedMetadata: Record<
              string,
              { sku?: string; barcode?: string }
            > = {};
            for (const [key, value] of Object.entries(
              formValues.variantMetadata,
            )) {
              const tokens = key.split("|");
              const resolvedTokens = tokens.map((token, idx) => {
                const tokenMap = resolvedVariant.tokenMaps[idx];
                return tokenMap?.get(token) ?? token;
              });
              updatedMetadata[resolvedTokens.join("|")] = value;
            }

            setFields({
              variantDimensions: updatedDimensions,
              enabledVariantKeys: updatedEnabledKeys,
              variantMetadata: updatedMetadata,
            });
          }

          setFields({
            imageFile: null,
            existingImageUrl: imagePath ?? formValues.existingImageUrl ?? null,
          });
          setHasAttemptedSubmit(false);
          setValidationErrors({});
          setInitialSnapshot(
            JSON.stringify(
              computeComparableState({
                ...formValues,
                imageFile: null,
                existingImageUrl:
                  imagePath ?? formValues.existingImageUrl ?? null,
              }),
            ),
          );

          // Invalidate other queries in the background (fire-and-forget)
          void queryClient.invalidateQueries({
            queryKey: trpc.products.get.queryKey({
              id: metadataRef.current.productId,
            }),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.products.list.queryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: trpc.summary.productStatus.queryKey(),
          });

          toast.success("Passport updated successfully");
          return;
        }

        // Create mode
        const created = await createProductMutation.mutateAsync(basePayload);
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
            isGhost?: boolean;
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
                isGhost: false, // Variants with attributes are always real (non-ghost)
              });
            }
          }

          if (variantsForSync.length > 0 && targetProductHandle) {
            await syncVariantsMutation.mutateAsync({
              productHandle: targetProductHandle,
              variants: variantsForSync,
            });
          }
        } else if (
          formValues.explicitVariants.length > 0 &&
          targetProductHandle
        ) {
          await syncVariantsMutation.mutateAsync({
            productHandle: targetProductHandle,
            variants: formValues.explicitVariants.map((v) => ({
              attributeValueIds: [],
              sku: v.sku || undefined,
              barcode: v.barcode || undefined,
              isGhost: false, // Explicit variants are always real (non-ghost)
            })),
          });
        } else if (targetProductHandle) {
          // No dimensions and no explicit variants - create a ghost variant.
          // Every product must have at least one variant (even without attribute values) to be publishable.
          // This ghost variant will be converted to a real variant if the user later adds attributes.
          await syncVariantsMutation.mutateAsync({
            productHandle: targetProductHandle,
            variants: [{ attributeValueIds: [], isGhost: true }],
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
      setFields,
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
