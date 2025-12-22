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
import type { VariantDimension, VariantMetadata } from "@/components/forms/passport/blocks/variant-block";

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

  // Materials
  materialData: Array<{ materialId: string; percentage: number }>;
  ecoClaims: Array<{ id: string; value: string }>;

  // Journey
  journeySteps: Array<{
    stepType: string;
    facilityId: string;
    sortIndex: number;
  }>;

  // Environment
  carbonKgCo2e: string;
  waterLiters: string;

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
  materialData: [],
  ecoClaims: [],
  journeySteps: [],
  carbonKgCo2e: "",
  waterLiters: "",
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
}

type PassportFormValidationFields = Pick<
  PassportFormValues,
  | "name"
  | "productHandle"
  | "description"
  | "materialData"
  | "carbonKgCo2e"
  | "waterLiters"
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
  if ((errors as any).materialData) mapped.materials = (errors as any).materialData;
  if (errors.carbonKgCo2e) mapped.carbonKgCo2e = errors.carbonKgCo2e;
  if (errors.waterLiters) mapped.waterLiters = errors.waterLiters;
  return mapped;
}

function getPassportValidationErrors(values: PassportFormValues): PassportFormValidationErrors {
  const fields: PassportFormValidationFields = {
    name: values.name,
    productHandle: values.productHandle,
    description: values.description,
    materialData: values.materialData,
    carbonKgCo2e: values.carbonKgCo2e,
    waterLiters: values.waterLiters,
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

  const [validationErrors, setValidationErrors] = React.useState<PassportFormValidationErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(null);

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

  const createProductMutation = useMutation(trpc.products.create.mutationOptions());
  const updateProductMutation = useMutation(trpc.products.update.mutationOptions());
  const upsertVariantsMutation = useMutation(trpc.products.variants.upsert.mutationOptions());
  const createEcoClaimMutation = useMutation(trpc.catalog.ecoClaims.create.mutationOptions());
  const createAttributeMutation = useMutation(trpc.catalog.attributes.create.mutationOptions());
  const createAttributeValueMutation = useMutation(trpc.catalog.attributeValues.create.mutationOptions());

  const passportFormQuery = useQuery({
    ...trpc.products.get.queryOptions({
      handle: productHandle ?? "",
      includeVariants: true,
      includeAttributes: true,
    }),
    enabled: isEditMode && !!productHandle && !initialData,
    initialData: initialData as any,
  });

  const state: PassportFormState = React.useMemo(
    () => ({ ...formValues, validationErrors, hasAttemptedSubmit }),
    [formValues, validationErrors, hasAttemptedSubmit],
  );

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
      materialData: values.materialData,
      ecoClaims: values.ecoClaims,
      journeySteps: values.journeySteps.map((step) => ({
        sortIndex: step.sortIndex,
        stepType: step.stepType,
        facilityId: step.facilityId,
      })),
      carbonKgCo2e: values.carbonKgCo2e,
      waterLiters: values.waterLiters,
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
    toast.error(passportFormQuery.error.message ?? "Failed to load passport data");
  }, [passportFormQuery.error]);

  React.useEffect(() => {
    if (!isEditMode || !passportFormQuery.data || hasHydratedRef.current) return;

    const payload = passportFormQuery.data as any;
    const variants = Array.isArray(payload?.variants) ? payload.variants : [];

    // Build dimensions and metadata from variant attributes
    // Store brand attribute value IDs so custom names (e.g. "Sky Blue") rehydrate correctly
    const dimensionMap = new Map<string, { 
      attributeId: string; 
      name: string; 
      taxonomyAttributeId: string | null; 
      values: Set<string>;
    }>();
    const metadata: Record<string, VariantMetadata> = {};

    for (const variant of variants) {
      const attrs = variant.attributes ?? [];
      const valueKeys: string[] = [];
      
      for (const attr of attrs) {
        const attrId = attr.attribute_id ?? attr.attributeId;
        const brandValueId = attr.value_id ?? attr.valueId;
        const attrName = attr.attribute_name ?? attr.attributeName ?? "Unknown";
        const taxAttrId = attr.taxonomy_attribute_id ?? attr.taxonomyAttributeId ?? null;

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
    const variantDimensions: VariantDimension[] = Array.from(dimensionMap.values()).map((d, idx) => ({
      id: `dim-${idx}`,
      attributeId: d.attributeId,
      attributeName: d.name,
      taxonomyAttributeId: d.taxonomyAttributeId,
      values: Array.from(d.values),
    }));

    // Handle explicit variants (no attributes)
    const explicitVariants: Array<{ sku: string; barcode: string }> = [];
    if (variantDimensions.length === 0 && variants.length > 0) {
      for (const v of variants) {
        explicitVariants.push({
          sku: v.sku ?? "",
          barcode: v.barcode ?? "",
        });
      }
    }

    const attributes = payload.attributes ?? {};
    const materials = attributes.materials?.map((m: any) => ({
      materialId: m.brand_material_id ?? m.material_id ?? m.materialId,
      percentage: typeof m.percentage === "string" ? Number(m.percentage) : m.percentage,
    })) ?? [];
    const ecoClaims = attributes.ecoClaims?.map((c: any) => ({
      id: c.eco_claim_id ?? c.ecoClaimId ?? c.id,
      value: c.claim ?? "",
    })) ?? [];
    const journeySteps = attributes.journey?.map((s: any) => ({
      sortIndex: s.sort_index ?? s.sortIndex ?? 0,
      stepType: s.step_type ?? s.stepType ?? "",
      facilityId: s.facility_id ?? s.facilityId ?? "",
    })) ?? [];
    const tagIds = attributes.tags?.map((t: any) => t.tag_id ?? t.tagId).filter(Boolean) ?? [];
    const environment = attributes.environment ?? {};

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
      materialData: materials,
      ecoClaims,
      journeySteps,
      carbonKgCo2e: stripTrailingZeros(environment.carbonKgCo2e ?? environment.carbon_kg_co2e ?? ""),
      waterLiters: stripTrailingZeros(environment.waterLiters ?? environment.water_liters ?? ""),
      status: payload.status ?? "unpublished",
    };

    setFields(nextValues);
    metadataRef.current = {
      productId: payload.id,
      productHandle: payload.product_handle ?? productHandle ?? undefined,
    };
    setInitialSnapshot(JSON.stringify(computeComparableState(nextValues)));
    setHasAttemptedSubmit(false);
    hasHydratedRef.current = true;
  }, [computeComparableState, isEditMode, passportFormQuery.data, setFields, productHandle]);

  React.useEffect(() => {
    if (isEditMode || initialSnapshot !== null) return;
    setInitialSnapshot(JSON.stringify(computeComparableState(formValues)));
  }, [computeComparableState, formValues, initialSnapshot, isEditMode]);

  const serializedState = React.useMemo(
    () => JSON.stringify(computeComparableState(formValues)),
    [computeComparableState, formValues],
  );
  const hasUnsavedChanges = initialSnapshot !== null && serializedState !== initialSnapshot;

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
  const resolveVariantDimensions = React.useCallback(async (): Promise<ResolvedVariantDimensionsResult> => {
    // Filter to dimensions that have values (either standard or custom inline)
    const dims = formValues.variantDimensions.filter((d) => {
      if (d.isCustomInline) {
        return (d.customValues ?? []).some((v) => v.trim().length > 0);
      }
      return d.values.length > 0;
    });
    if (dims.length === 0) return { dimensions: [], tokenMaps: [] };

    const brandCatalogQuery = queryClient.getQueryData(trpc.composite.catalogContent.queryKey()) as any;
    // Copy to mutable working lists so we can include newly-created attrs/values
    // in subsequent lookups within the same submit.
    const existingBrandAttrs: any[] = [...(brandCatalogQuery?.brandCatalog?.attributes ?? [])];
    const existingBrandValues: any[] = [...(brandCatalogQuery?.brandCatalog?.attributeValues ?? [])];

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
          (a: any) => a.name.toLowerCase() === attrName.toLowerCase() && !a.taxonomyAttributeId
        );
        if (existing) {
          brandAttrId = existing.id;
        } else {
          const result = await createAttributeMutation.mutateAsync({ name: attrName });
          if (!result?.data?.id) throw new Error("Failed to create custom attribute");
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
            (v: any) => v.attributeId === brandAttrId && v.name.toLowerCase() === trimmedName.toLowerCase()
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
            if (!result?.data?.id) throw new Error("Failed to create custom attribute value");
            resolvedValueIds.push(result.data.id);
            tokenToBrandValueId.set(trimmedName, result.data.id);
            tokenToBrandValueId.set(result.data.id, result.data.id);
            existingBrandValues.push(result.data);
          }
        }

        if (resolvedValueIds.length > 0) {
          resolved.push({ attribute_id: brandAttrId!, value_ids: resolvedValueIds });
          tokenMaps.push(tokenToBrandValueId);
        }
        continue;
      }

      // Create brand attribute if it doesn't exist (indicated by tax: prefix)
      if (brandAttrId?.startsWith("tax:")) {
        const taxAttrId = brandAttrId.slice(4);
        const existing = existingBrandAttrs.find((a: any) => a.taxonomyAttributeId === taxAttrId);
        if (existing) {
          brandAttrId = existing.id;
        } else {
          const result = await createAttributeMutation.mutateAsync({
            name: dim.attributeName,
            taxonomy_attribute_id: taxAttrId,
          });
          if (!result?.data?.id) throw new Error("Failed to create attribute");
          brandAttrId = result.data.id;
          existingBrandAttrs.push(result.data);
        }
      }

      if (!brandAttrId) continue;

      // Resolve values
      const resolvedValueIds: string[] = [];

      if (dim.taxonomyAttributeId) {
        // Taxonomy-linked: values are brand value IDs (already created via modal)
        for (const valueId of dim.values) {
          // Values should already be brand value IDs
          const existingBrandValue = existingBrandValues.find(
            (v: any) => v.id === valueId && v.attributeId === brandAttrId
          );

          if (existingBrandValue) {
            resolvedValueIds.push(existingBrandValue.id);
            tokenToBrandValueId.set(valueId, existingBrandValue.id);
            tokenToBrandValueId.set(existingBrandValue.name, existingBrandValue.id);
          } else {
            // Check if it's a taxonomy value ID that needs a brand value
            const existingByTaxonomy = existingBrandValues.find(
              (v: any) => v.attributeId === brandAttrId && v.taxonomyValueId === valueId
            );
            if (existingByTaxonomy) {
              resolvedValueIds.push(existingByTaxonomy.id);
              tokenToBrandValueId.set(valueId, existingByTaxonomy.id);
              tokenToBrandValueId.set(existingByTaxonomy.name, existingByTaxonomy.id);
              tokenToBrandValueId.set(existingByTaxonomy.id, existingByTaxonomy.id);
            } else {
              // Create brand value for taxonomy value
              const taxValues = brandCatalogQuery?.taxonomy?.values ?? [];
              const taxValue = taxValues.find((v: any) => v.id === valueId);
              const name = taxValue?.name ?? valueId;

              const result = await createAttributeValueMutation.mutateAsync({
                attribute_id: brandAttrId,
                name,
                taxonomy_value_id: valueId,
              });
              if (!result?.data?.id) throw new Error("Failed to create attribute value");
              resolvedValueIds.push(result.data.id);
              tokenToBrandValueId.set(valueId, result.data.id);
              tokenToBrandValueId.set(result.data.name ?? name, result.data.id);
              tokenToBrandValueId.set(result.data.id, result.data.id);
              existingBrandValues.push(result.data);
            }
          }
        }
      } else {
        // Existing custom attribute: values are brand value IDs (already created via modal)
        for (const valueId of dim.values) {
          // Check if this is already a valid brand value ID
          const existingBrandValue = existingBrandValues.find(
            (v: any) => v.id === valueId && v.attributeId === brandAttrId
          );

          if (existingBrandValue) {
            resolvedValueIds.push(existingBrandValue.id);
            tokenToBrandValueId.set(valueId, existingBrandValue.id);
            tokenToBrandValueId.set(existingBrandValue.name, existingBrandValue.id);
          } else {
            // Might be a value name if the attribute was previously custom inline
            const existingByName = existingBrandValues.find(
              (v: any) => v.attributeId === brandAttrId && v.name === valueId
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
              if (!result?.data?.id) throw new Error("Failed to create attribute value");
              resolvedValueIds.push(result.data.id);
              tokenToBrandValueId.set(valueId, result.data.id);
              tokenToBrandValueId.set(result.data.id, result.data.id);
              existingBrandValues.push(result.data);
            }
          }
        }
      }

      resolved.push({ attribute_id: brandAttrId, value_ids: resolvedValueIds });
      tokenMaps.push(tokenToBrandValueId);
    }

    void queryClient.invalidateQueries({ queryKey: trpc.composite.catalogContent.queryKey() });
    return { dimensions: resolved, tokenMaps };
  }, [formValues.variantDimensions, createAttributeMutation, createAttributeValueMutation, queryClient, trpc]);

  const resolveEcoClaims = React.useCallback(async () => {
    if (!formValues.ecoClaims.length) return [];

    const validClaims = formValues.ecoClaims.filter((c) => c.value.trim().length > 0);
    if (validClaims.length === 0) return [];

    const resolvedIds: string[] = [];
    const brandCatalogQuery = queryClient.getQueryData(trpc.composite.catalogContent.queryKey()) as any;
    const existingEcoClaims = brandCatalogQuery?.brandCatalog?.ecoClaims ?? [];
    const ecoClaimByText = new Map<string, { id?: string; claim: string }>();
    
    for (const ec of existingEcoClaims) {
      ecoClaimByText.set(ec.claim.trim().toLowerCase(), { id: ec.id, claim: ec.claim });
    }

    for (const claim of validClaims) {
      const normalizedText = claim.value.trim().toLowerCase();

      if (claim.id && claim.id.length > 5) {
        const existsInCache = existingEcoClaims.some((ec: any) => ec.id === claim.id);
        if (existsInCache) {
          resolvedIds.push(claim.id);
          continue;
        }
      }

      const existing = ecoClaimByText.get(normalizedText);
      if (existing?.id) {
        resolvedIds.push(existing.id);
        continue;
      }

      const result = await createEcoClaimMutation.mutateAsync({ claim: claim.value.trim() });
      if (!result?.data?.id) throw new Error("Failed to create eco-claim");
      resolvedIds.push(result.data.id);
      ecoClaimByText.set(normalizedText, { id: result.data.id, claim: result.data.claim });
    }

    void queryClient.invalidateQueries({ queryKey: trpc.catalog.ecoClaims.list.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.composite.catalogContent.queryKey() });

    return resolvedIds;
  }, [formValues.ecoClaims, createEcoClaimMutation, queryClient, trpc]);

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
              allowedMime: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"],
            },
          });
          imagePath = result.storageUrl;
        }

        // Always send eco claims - empty array clears claims, undefined skips update
        const ecoClaimIds = await resolveEcoClaims();

        // Resolve variant dimensions (creates brand attributes/values as needed)
        const resolvedVariant = await resolveVariantDimensions();
        const resolvedDimensions = resolvedVariant.dimensions;
        const variantMetadataForUpsert =
          resolvedDimensions.length > 0
            ? translateVariantMetadataKeys(resolvedVariant.tokenMaps, formValues.variantMetadata)
            : undefined;

        const materials = formValues.materialData.length > 0
          ? formValues.materialData.map((m) => ({ brand_material_id: m.materialId, percentage: m.percentage }))
          : undefined;
        // Always send tagIds - empty array clears tags, undefined skips update
        const tagIds = formValues.tagIds;
        const journeySteps = formValues.journeySteps.length > 0
          ? formValues.journeySteps.map((s) => ({
              sort_index: s.sortIndex,
              step_type: s.stepType,
              facility_id: s.facilityId,
            }))
          : undefined;
        const environmentPayload =
          formValues.carbonKgCo2e.trim() || formValues.waterLiters.trim()
            ? {
                carbon_kg_co2e: formValues.carbonKgCo2e.trim() || undefined,
                water_liters: formValues.waterLiters.trim() || undefined,
              }
            : undefined;

        const basePayload = {
          brand_id: brandId,
          name,
          product_handle: productHandle,
          description: formValues.description.trim() || undefined,
          category_id: formValues.categoryId ?? undefined,
          season_id: formValues.seasonId, // null clears season, undefined skips update
          manufacturer_id: formValues.manufacturerId || undefined,
          image_path: imagePath ?? formValues.existingImageUrl ?? undefined,
          status: (formValues.status || "unpublished") as "published" | "scheduled" | "unpublished" | "archived",
          materials,
          tag_ids: tagIds,
          eco_claim_ids: ecoClaimIds,
          journey_steps: journeySteps,
          environment: environmentPayload,
        };

        if (isEditMode) {
          const effectiveProductHandle = productHandle ?? metadataRef.current.productHandle ?? null;
          if (!metadataRef.current.productId || !effectiveProductHandle) {
            throw new Error("Unable to update passport: missing context");
          }

          await updateProductMutation.mutateAsync({
            ...basePayload,
            id: metadataRef.current.productId,
          });

          // Upsert variants using new matrix mode
          if (resolvedDimensions.length > 0) {
            await upsertVariantsMutation.mutateAsync({
              product_id: metadataRef.current.productId,
              mode: "matrix",
              dimensions: resolvedDimensions,
              variant_metadata: variantMetadataForUpsert,
            });
          } else if (formValues.explicitVariants.length > 0) {
            await upsertVariantsMutation.mutateAsync({
              product_id: metadataRef.current.productId,
              mode: "explicit",
              variants: formValues.explicitVariants.map((v) => ({
                sku: v.sku || undefined,
                barcode: v.barcode || undefined,
              })),
            });
          }

          setFields({
            imageFile: null,
            existingImageUrl: imagePath ?? formValues.existingImageUrl ?? null,
          });
          setHasAttemptedSubmit(false);
          setValidationErrors({});
          setInitialSnapshot(JSON.stringify(computeComparableState({
            ...formValues,
            imageFile: null,
            existingImageUrl: imagePath ?? formValues.existingImageUrl ?? null,
          })));

          void queryClient.invalidateQueries({ queryKey: trpc.products.get.queryKey({ handle: effectiveProductHandle }) });
          void queryClient.invalidateQueries({ queryKey: trpc.products.get.queryKey({ id: metadataRef.current.productId }) });
          void queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
          void queryClient.invalidateQueries({ queryKey: trpc.summary.productStatus.queryKey() });

          toast.success("Passport updated successfully");
          return;
        }

        // Create mode
        const created = await createProductMutation.mutateAsync(basePayload);
        const productId = created?.data?.id;
        const targetProductHandle = (created as any)?.data?.product_handle ?? productHandle ?? null;
        if (!productId) throw new Error("Product was not created");

        // Upsert variants
        if (resolvedDimensions.length > 0) {
          await upsertVariantsMutation.mutateAsync({
            product_id: productId,
            mode: "matrix",
            dimensions: resolvedDimensions,
            variant_metadata: variantMetadataForUpsert,
          });
        }

        void Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.composite.catalogContent.queryKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.products.get.queryKey({ id: productId }) }),
          targetProductHandle && queryClient.invalidateQueries({ queryKey: trpc.products.get.queryKey({ handle: targetProductHandle }) }),
          queryClient.invalidateQueries({ queryKey: trpc.summary.productStatus.queryKey() }),
        ]);

        toast.success("Passport created successfully");
        if (targetProductHandle) {
          router.push(`/passports/edit/${targetProductHandle}`);
        } else {
          router.push("/passports");
        }

        setValidationErrors({});
        setHasAttemptedSubmit(false);
        resetFormValues();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create passport";
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
      resolveEcoClaims,
      resolveVariantDimensions,
      createProductMutation,
      updateProductMutation,
      upsertVariantsMutation,
      buildPath,
      resetFormValues,
      setFields,
    ],
  );

  return {
    state,
    setField,
    updateField,
    resetForm: resetFormValues,
    clearValidationError,
    validate,
    submit,
    isSubmitting,
    error,
    isInitializing: isEditMode && (!hasHydratedRef.current || passportFormQuery.isLoading),
    hasUnsavedChanges,
  };
}
