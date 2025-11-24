import type { TierTwoSizeOption } from "@/components/select/size-select";
import { useTRPC } from "@/trpc/client";
import { useFormState } from "@/hooks/use-form-state";
import { useUpload } from "@/hooks/use-upload";
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

export type PendingColorSelection = { name: string; hex: string };

export interface PassportFormValues {
  // Basic info
  name: string;
  productIdentifier: string;
  description: string;
  imageFile: File | null;
  existingImageUrl: string | null;

  // Organization
  categoryId: string | null;
  seasonId: string | null;
  showcaseBrandId: string | null;
  tagIds: string[];

  // Variant
  colorIds: string[];
  pendingColors: PendingColorSelection[];
  selectedSizes: TierTwoSizeOption[];

  // Materials
  materialData: Array<{ materialId: string; percentage: number }>;
  ecoClaims: Array<{ id: string; value: string }>;

  // Journey
  journeySteps: Array<{
    stepType: string;
    facilityIds: string[]; // Changed from facilityId to support multiple operators
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
  productUpid?: string;
  sizeOptions?: TierTwoSizeOption[];
  colors?: Array<{ id: string; name: string; hex: string }>;
}

const initialFormValues: PassportFormValues = {
  name: "",
  productIdentifier: "",
  description: "",
  imageFile: null,
  existingImageUrl: null,
  categoryId: null,
  seasonId: null,
  showcaseBrandId: null,
  tagIds: [],
  colorIds: [],
  pendingColors: [],
  selectedSizes: [],
  materialData: [],
  ecoClaims: [],
  journeySteps: [],
  carbonKgCo2e: "",
  waterLiters: "",
  status: "unpublished",
};

export interface PassportFormValidationErrors {
  name?: string;
  productIdentifier?: string;
  description?: string;
  colors?: string;
  selectedSizes?: string;
  materials?: string;
  carbonKgCo2e?: string;
  waterLiters?: string;
}

type PassportFormValidationFields = Pick<
  PassportFormValues,
  | "name"
  | "productIdentifier"
  | "description"
  | "colorIds"
  | "selectedSizes"
  | "materialData"
  | "carbonKgCo2e"
  | "waterLiters"
>;

const passportFormSchema: ValidationSchema<PassportFormValidationFields> = {
  name: [
    rules.required("Name is required"),
    rules.maxLength(100, "Name must be 100 characters or less"),
  ],
  productIdentifier: [
    rules.required("Product identifier is required"),
    rules.maxLength(100, "Product identifier must be 100 characters or less"),
  ],
  description: [rules.maxLength(1000, "Description must be 1000 characters or less")],
  colorIds: [rules.maxArrayLength(12, "You can select up to 12 colors per passport")],
  selectedSizes: [rules.maxArrayLength(12, "You can select up to 12 sizes per passport")],
  carbonKgCo2e: [rules.positiveNumeric("Carbon value must be a valid positive number")],
  waterLiters: [rules.positiveNumeric("Water value must be a valid positive number")],
  materialData: [
    (materials) => {
      if (!materials || materials.length === 0) {
        return undefined;
      }

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
  if (errors.productIdentifier)
    mapped.productIdentifier = errors.productIdentifier;
  if (errors.description) mapped.description = errors.description;
  if (errors.colorIds) mapped.colors = errors.colorIds;
  if (errors.selectedSizes) mapped.selectedSizes = errors.selectedSizes;
  if ((errors as any).materialData) mapped.materials = (errors as any).materialData;
  if (errors.carbonKgCo2e) mapped.carbonKgCo2e = errors.carbonKgCo2e;
  if (errors.waterLiters) mapped.waterLiters = errors.waterLiters;

  return mapped;
}

function getPassportValidationErrors(
  values: PassportFormValues,
): PassportFormValidationErrors {
  const fields: PassportFormValidationFields = {
    name: values.name,
    productIdentifier: values.productIdentifier,
    description: values.description,
    colorIds: values.colorIds,
    selectedSizes: values.selectedSizes,
    materialData: values.materialData,
    carbonKgCo2e: values.carbonKgCo2e,
    waterLiters: values.waterLiters,
  };

  const errors = validateForm(fields, passportFormSchema);
  const mapped = mapValidationErrors(errors);

  const totalColors =
    (values.colorIds?.length ?? 0) + (values.pendingColors?.length ?? 0);
  if (totalColors > 12) {
    mapped.colors = "You can select up to 12 colors per passport";
  }

  return mapped;
}

export function usePassportForm(options?: UsePassportFormOptions) {
  const mode = options?.mode ?? "create";
  const productUpid = options?.productUpid ?? null;
  const sizeOptions = options?.sizeOptions ?? [];
  const brandColors = options?.colors ?? [];
  const isEditMode = mode === "edit";

  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uploadFile } = useUpload();

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

  const metadataRef = React.useRef<{
    productId?: string;
    passportUpid?: string;
    productUpid?: string;
  }>({});
  const hasHydratedRef = React.useRef(false);
  const initialVariantSignatureRef = React.useRef<string | null>(null);

  const createProductMutation = useMutation(
    trpc.products.create.mutationOptions(),
  );
  const updateProductMutation = useMutation(
    trpc.products.update.mutationOptions(),
  );
  const upsertVariantsMutation = useMutation(
    trpc.products.variants.upsert.mutationOptions(),
  );

  const createBrandColorMutation = useMutation(
    trpc.brand.colors.create.mutationOptions(),
  );

  const passportFormQuery = useQuery({
    ...trpc.products.getByUpid.queryOptions({
      upid: productUpid ?? "",
      includeVariants: true,
      includeAttributes: true,
    }),
    enabled: isEditMode && !!productUpid,
  });

  const state: PassportFormState = React.useMemo(
    () => ({
      ...formValues,
      validationErrors,
      hasAttemptedSubmit,
    }),
    [formValues, validationErrors, hasAttemptedSubmit],
  );

  const clearValidationError = React.useCallback(
    (field: keyof PassportFormValidationErrors) => {
      setValidationErrors((prev) => {
        if (!prev[field]) {
          return prev;
        }
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const mapSizeIdsToOptions = React.useCallback(
    (sizeIds: string[] | undefined) => {
      if (!sizeIds?.length) {
        return [] as TierTwoSizeOption[];
      }
      if (sizeOptions.length === 0) {
        return [];
      }
      const optionMap = new Map<string, TierTwoSizeOption>();
      for (const option of sizeOptions) {
        if (option.id) {
          optionMap.set(option.id, option);
        }
      }
      return sizeIds
        .map((id) => optionMap.get(id))
        .filter((option): option is TierTwoSizeOption => !!option);
    },
    [sizeOptions],
  );

  const computeComparableState = React.useCallback(
    (values: PassportFormValues) => ({
      name: values.name,
      productIdentifier: values.productIdentifier,
      description: values.description,
      categoryId: values.categoryId,
      seasonId: values.seasonId,
      showcaseBrandId: values.showcaseBrandId,
      tagIds: values.tagIds,
      colorIds: values.colorIds,
      pendingColors: values.pendingColors.map(
        (color) => `${color.name}:${color.hex}`,
      ),
      selectedSizes: values.selectedSizes.map(
        (size) => size.id ?? `${size.categoryKey ?? ""}:${size.name}`,
      ),
      materialData: values.materialData.map((material) => ({
        materialId: material.materialId,
        percentage: material.percentage,
      })),
      ecoClaims: values.ecoClaims,
      journeySteps: values.journeySteps.map((step) => ({
        sortIndex: step.sortIndex,
        stepType: step.stepType,
        facilityIds: step.facilityIds,
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

  const buildVariantSignature = React.useCallback(
    (colorIds?: readonly string[], sizeIds?: readonly string[]) => {
      const normalize = (ids?: readonly string[]) =>
        Array.from(new Set((ids ?? []).filter(Boolean))).sort().join("|");
      return `${normalize(colorIds)}::${normalize(sizeIds)}`;
    },
    [],
  );

  React.useEffect(() => {
    if (!passportFormQuery.error) {
      return;
    }
    const message =
      passportFormQuery.error.message ?? "Failed to load passport data";
    toast.error(message);
  }, [passportFormQuery.error]);

  React.useEffect(() => {
    if (!isEditMode) {
      return;
    }
    if (!passportFormQuery.data) {
      return;
    }
    if (hasHydratedRef.current) {
      return;
    }
    const payload = passportFormQuery.data as any;

    const variants = Array.isArray(payload?.variants)
      ? payload.variants
      : [];
    const colorIds: string[] = Array.from(
      new Set(
        variants
          .map((v: any) => v.color_id ?? v.colorId ?? null)
          .filter((id: any): id is string => typeof id === "string"),
      ),
    );
    const sizeIds: string[] = Array.from(
      new Set(
        variants
          .map((v: any) => v.size_id ?? v.sizeId ?? null)
          .filter((id: any): id is string => typeof id === "string"),
      ),
    );
    if (sizeIds.length > 0 && sizeOptions.length === 0) {
      return;
    }
    const selectedSizes = mapSizeIdsToOptions(sizeIds);

    const attributes = payload.attributes ?? {};
    const materials =
      attributes.materials?.map((material: any) => ({
        materialId:
          material.brand_material_id ??
          material.material_id ??
          material.materialId,
        percentage:
          typeof material.percentage === "string"
            ? Number(material.percentage)
            : material.percentage,
      })) ?? [];
    const ecoClaims =
      attributes.ecoClaims?.map(
        (claim: any) => ({
          id: claim.eco_claim_id ?? claim.ecoClaimId ?? claim.id,
          value: claim.claim ?? "",
        }),
      ) ?? [];
    const journeySteps =
      attributes.journey?.map((step: any) => ({
        sortIndex: step.sort_index ?? step.sortIndex ?? 0,
        stepType: step.step_type ?? step.stepType ?? "",
        facilityIds: step.facility_ids ?? step.facilityIds ?? [], // Changed from facilityId to support multiple operators
      })) ?? [];
    const tagIds =
      attributes.tags?.map((tag: any) => tag.tag_id ?? tag.tagId).filter(Boolean) ??
      [];
    const environment = attributes.environment ?? {};

    const nextValues: PassportFormValues = {
      ...initialFormValues,
      name: payload.name ?? "",
      productIdentifier:
        (payload as any).productIdentifier ??
        (payload as any).product_identifier ??
        "",
      description: payload.description ?? "",
      imageFile: null,
      existingImageUrl:
        payload.primaryImageUrl ??
        (payload as any).primary_image_url ??
        null,
      categoryId: payload.categoryId ?? payload.category_id ?? null,
      seasonId: payload.seasonId ?? payload.season_id ?? null,
      showcaseBrandId:
        payload.showcaseBrandId ?? payload.showcase_brand_id ?? null,
      tagIds,
      colorIds,
      pendingColors: [],
      selectedSizes,
      materialData: materials,
      ecoClaims,
      journeySteps,
      carbonKgCo2e:
        environment.carbonKgCo2e ??
        environment.carbon_kg_co2e ??
        "",
      waterLiters:
        environment.waterLiters ??
        environment.water_liters ??
        "",
      status: payload.status ?? "unpublished",
    };
    setFields(nextValues);
    metadataRef.current = {
      productId: payload.id,
      productUpid: payload.upid ?? productUpid ?? undefined,
    };
    const hydratedSizeIds: string[] = selectedSizes
      .map((size) => size.id)
      .filter((id): id is string => Boolean(id));
    initialVariantSignatureRef.current = buildVariantSignature(
      colorIds,
      hydratedSizeIds,
    );
    const snapshot = JSON.stringify(computeComparableState(nextValues));
    setInitialSnapshot(snapshot);
    setHasAttemptedSubmit(false);
    hasHydratedRef.current = true;
  }, [
    buildVariantSignature,
    computeComparableState,
    isEditMode,
    mapSizeIdsToOptions,
    passportFormQuery.data,
    setFields,
    sizeOptions,
  ]);

  React.useEffect(() => {
    if (isEditMode) {
      return;
    }
    if (initialSnapshot !== null) {
      return;
    }
    const snapshot = JSON.stringify(computeComparableState(formValues));
    setInitialSnapshot(snapshot);
    const initialSizeIds: string[] = formValues.selectedSizes
      .map((size) => size.id)
      .filter((id): id is string => Boolean(id));
    initialVariantSignatureRef.current = buildVariantSignature(
      formValues.colorIds,
      initialSizeIds,
    );
  }, [
    buildVariantSignature,
    computeComparableState,
    formValues,
    initialSnapshot,
    isEditMode,
  ]);

  const comparableState = React.useMemo(
    () => computeComparableState(formValues),
    [computeComparableState, formValues],
  );
  const serializedState = React.useMemo(
    () => JSON.stringify(comparableState),
    [comparableState],
  );
  const hasUnsavedChanges =
    initialSnapshot !== null && serializedState !== initialSnapshot;

  const validate = React.useCallback((): PassportFormValidationErrors => {
    const errors = getPassportValidationErrors(formValues);
    setValidationErrors(errors);
    return errors;
  }, [formValues]);

  const resolvePendingColors = React.useCallback(async () => {
    if (!formValues.pendingColors.length) {
      return formValues.colorIds;
    }

    const resolvedIds = new Set(formValues.colorIds);
    const createdColorMetadata: Array<{
      id: string;
      name: string;
      hex: string;
      created_at?: string;
      updated_at?: string;
    }> = [];
    const colorByName = new Map<
      string,
      { id?: string; name: string; hex: string }
    >();

    for (const color of brandColors) {
      colorByName.set(color.name.toLowerCase(), {
        id: color.id,
        name: color.name,
        hex: color.hex,
      });
    }

    for (const pending of formValues.pendingColors) {
      const key = pending.name.trim().toLowerCase();
      if (!key) continue;
      const existing = colorByName.get(key);
      if (existing?.id) {
        resolvedIds.add(existing.id);
        continue;
      }

      const result = await createBrandColorMutation.mutateAsync({
        name: pending.name,
        hex: pending.hex,
      });
      const created = result?.data;
      if (!created?.id) {
        throw new Error("Failed to create color");
      }
      const normalizedHex = (created.hex ?? pending.hex)
        .replace("#", "")
        .trim()
        .toUpperCase();
      resolvedIds.add(created.id);
      const metadata = {
        id: created.id,
        name: created.name ?? pending.name,
        hex: normalizedHex,
        created_at: created.created_at ?? new Date().toISOString(),
        updated_at: created.updated_at ?? new Date().toISOString(),
      };
      createdColorMetadata.push(metadata);
      colorByName.set(key, metadata);
    }

    if (createdColorMetadata.length > 0) {
      queryClient.setQueryData(
        trpc.brand.colors.list.queryKey(),
        (old: any) => {
          if (!old?.data) {
            return old;
          }
          const existingNames = new Set(
            old.data.map((color: any) => color.name.toLowerCase()),
          );
          const appended = createdColorMetadata.filter(
            (color) => !existingNames.has(color.name.toLowerCase()),
          );
          if (appended.length === 0) {
            return old;
          }
          return {
            ...old,
            data: [...old.data, ...appended],
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: trpc.brand.colors.list.queryKey(),
      });
      void queryClient.invalidateQueries({
        queryKey: trpc.composite.brandCatalogContent.queryKey(),
      });
    }

    const resolvedIdsArray = Array.from(resolvedIds);
    setFields({
      colorIds: resolvedIdsArray,
      pendingColors: [],
    });

    return resolvedIdsArray;
  }, [
    brandColors,
    createBrandColorMutation,
    formValues.colorIds,
    formValues.pendingColors,
    queryClient,
    setFields,
    trpc.composite.brandCatalogContent,
  ]);

  const createEcoClaimMutation = useMutation(
    trpc.brand.ecoClaims.create.mutationOptions(),
  );

  const resolveEcoClaims = React.useCallback(async () => {
    if (!formValues.ecoClaims.length) {
      return [];
    }

    // Filter out eco-claims with empty values
    const validClaims = formValues.ecoClaims.filter((claim) =>
      claim.value.trim().length > 0
    );

    if (validClaims.length === 0) {
      return [];
    }

    const resolvedIds: string[] = [];
    const updatedClaims: Array<{ id: string; value: string }> = [];

    // Get existing eco-claims to check for duplicates
    const existingEcoClaimsQuery = queryClient.getQueryData(
      trpc.brand.ecoClaims.list.queryKey(),
    ) as any;
    const existingEcoClaims = existingEcoClaimsQuery?.data ?? [];

    const ecoClaimByText = new Map<string, { id?: string; claim: string }>();
    for (const ecoClaim of existingEcoClaims) {
      const normalizedClaim = ecoClaim.claim.trim().toLowerCase();
      ecoClaimByText.set(normalizedClaim, {
        id: ecoClaim.id,
        claim: ecoClaim.claim,
      });
    }

    for (const claim of validClaims) {
      const normalizedText = claim.value.trim().toLowerCase();

      // First, check if the claim already has a valid ID in the form state
      // This happens when editing an existing product with eco-claims
      if (claim.id && claim.id.length > 5) { // Assuming UUIDs are longer than timestamp strings
        // Verify the ID is still valid by checking if it exists in cache
        const existsInCache = existingEcoClaims.some((ec: any) => ec.id === claim.id);
        if (existsInCache) {
          resolvedIds.push(claim.id);
          updatedClaims.push({ id: claim.id, value: claim.value.trim() });
          continue;
        }
      }

      // Check if an eco-claim with the same text already exists
      const existing = ecoClaimByText.get(normalizedText);

      if (existing?.id) {
        // Use existing eco-claim ID
        resolvedIds.push(existing.id);
        updatedClaims.push({ id: existing.id, value: existing.claim });
        continue;
      }

      // Create new eco-claim
      const result = await createEcoClaimMutation.mutateAsync({
        claim: claim.value.trim(),
      });
      const created = result?.data;
      if (!created?.id) {
        throw new Error("Failed to create eco-claim");
      }

      resolvedIds.push(created.id);
      updatedClaims.push({ id: created.id, value: created.claim });
      ecoClaimByText.set(normalizedText, {
        id: created.id,
        claim: created.claim,
      });
    }

    // Invalidate eco-claims cache so the list is fresh
    void queryClient.invalidateQueries({
      queryKey: trpc.brand.ecoClaims.list.queryKey(),
    });

    return resolvedIds;
  }, [
    formValues.ecoClaims,
    createEcoClaimMutation,
    queryClient,
    setFields,
    trpc.brand.ecoClaims.list,
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
        if (!name) {
          throw new Error("Name is required");
        }

        const productIdentifier = formValues.productIdentifier.trim();
        if (!productIdentifier) {
          throw new Error("Product identifier is required");
        }

        let primaryImageUrl: string | undefined;
        if (formValues.imageFile) {
          try {
            const timestamp = Date.now();
            const sanitizedFileName = formValues.imageFile.name.replace(
              /[^a-zA-Z0-9.-]/g,
              "_",
            );
            const sanitizedBrandId = brandId.trim();
            const result = await uploadFile({
              file: formValues.imageFile,
              path: [sanitizedBrandId, `${timestamp}-${sanitizedFileName}`],
              bucket: "products",
              metadata: { brand_id: sanitizedBrandId },
            });
            primaryImageUrl = result.url;
          } catch (err) {
            throw new Error(
              `Failed to upload image: ${err instanceof Error ? err.message : "Unknown error"
              }`,
            );
          }
        }

        const safeDescription = formValues.description.trim() || undefined;
        const safeSeasonId = formValues.seasonId || undefined;
        const safeShowcaseBrandId = formValues.showcaseBrandId || undefined;
        const resolvedColorIds = await resolvePendingColors();
        const colorIds =
          resolvedColorIds.length > 0 ? resolvedColorIds : undefined;
        const sizeIds = formValues.selectedSizes
          .map((size) => size.id)
          .filter((id): id is string => Boolean(id));
        const variantSignature = buildVariantSignature(colorIds, sizeIds);
        const variantsChanged =
          initialVariantSignatureRef.current !== variantSignature;
        const materials =
          formValues.materialData.length > 0
            ? formValues.materialData.map((material) => ({
              brand_material_id: material.materialId,
              percentage: material.percentage,
            }))
            : undefined;
        const tagIds =
          formValues.tagIds.length > 0 ? formValues.tagIds : undefined;

        // Resolve eco-claims (create brand eco-claims and get IDs)
        const resolvedEcoClaimIds = await resolveEcoClaims();
        const ecoClaimIds =
          resolvedEcoClaimIds.length > 0 ? resolvedEcoClaimIds : undefined;

        const journeySteps =
          formValues.journeySteps.length > 0
            ? formValues.journeySteps.map((step) => ({
              sort_index: step.sortIndex,
              step_type: step.stepType,
              facility_ids: step.facilityIds, // Changed from facilityId to support multiple operators
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
          product_identifier: productIdentifier,
          description: safeDescription,
          category_id: formValues.categoryId ?? undefined,
          season_id: safeSeasonId,
          showcase_brand_id: safeShowcaseBrandId,
          primary_image_url:
            primaryImageUrl ?? formValues.existingImageUrl ?? undefined,
          status: (formValues.status ||
            "unpublished") as
            | "published"
            | "scheduled"
            | "unpublished"
            | "archived",
          materials,
          tag_ids: tagIds,
          eco_claim_ids: ecoClaimIds,
          journey_steps: journeySteps,
          environment: environmentPayload,
        };

        if (isEditMode) {
          const effectiveProductUpid =
            productUpid ?? metadataRef.current.productUpid ?? null;
          if (!metadataRef.current.productId || !effectiveProductUpid) {
            throw new Error("Unable to update passport: missing context");
          }

          await updateProductMutation.mutateAsync({
            ...basePayload,
            id: metadataRef.current.productId,
            brand_id: brandId,
          });

          if (variantsChanged) {
            await upsertVariantsMutation.mutateAsync({
              product_id: metadataRef.current.productId,
              color_ids: colorIds,
              size_ids: sizeIds,
            });
          }

          const nextValues: Partial<PassportFormValues> = {
            name,
            productIdentifier,
            description: safeDescription ?? "",
            seasonId: safeSeasonId ?? null,
            showcaseBrandId: safeShowcaseBrandId ?? null,
            tagIds: formValues.tagIds,
            imageFile: null,
            existingImageUrl:
              primaryImageUrl ?? formValues.existingImageUrl ?? null,
            colorIds: colorIds ?? [],
            pendingColors: [],
            selectedSizes: formValues.selectedSizes,
            materialData: formValues.materialData,
            ecoClaims: formValues.ecoClaims,
            journeySteps: formValues.journeySteps,
            carbonKgCo2e: formValues.carbonKgCo2e,
            waterLiters: formValues.waterLiters,
            status: basePayload.status,
          };
          setFields(nextValues);
          setHasAttemptedSubmit(false);
          setValidationErrors({});
          const snapshot = JSON.stringify(
            computeComparableState({
              ...formValues,
              ...nextValues,
            } as PassportFormValues),
          );
          setInitialSnapshot(snapshot);
          initialVariantSignatureRef.current = variantSignature;
          if (effectiveProductUpid) {
            void queryClient.invalidateQueries({
              queryKey: trpc.products.getByUpid.queryKey({
                upid: effectiveProductUpid,
              }),
            });
          }
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

        const created = await createProductMutation.mutateAsync({
          ...basePayload,
          brand_id: brandId,
        });

        const productId = created?.data?.id;
        const targetProductUpid =
          (created as any)?.data?.upid ?? productUpid ?? null;
        if (!productId) {
          throw new Error("Product was not created");
        }

        const shouldUpsertVariants =
          (colorIds?.length ?? 0) > 0 || sizeIds.length > 0;
        if (shouldUpsertVariants) {
          await upsertVariantsMutation.mutateAsync({
            product_id: productId,
            color_ids: colorIds,
            size_ids: sizeIds,
          });
        }

        void Promise.allSettled([
          queryClient.invalidateQueries({
            queryKey: trpc.products.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.brand.colors.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.brandCatalogContent.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.products.get.queryKey({ id: productId }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.summary.productStatus.queryKey(),
          }),
        ]);

        toast.success("Passports created successfully");
        if (targetProductUpid) {
          router.push(`/passports/edit/${targetProductUpid}`);
        } else {
          router.push("/passports");
        }

        setValidationErrors({});
        setHasAttemptedSubmit(false);
        resetFormValues();
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
      buildVariantSignature,
      computeComparableState,
      formValues,
      isEditMode,
      metadataRef,
      queryClient,
      router,
      trpc,
      uploadFile,
      validate,
      productUpid,
      resolvePendingColors,
      resolveEcoClaims,
      createProductMutation,
      updateProductMutation,
      upsertVariantsMutation,
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
    isInitializing:
      isEditMode && (!hasHydratedRef.current || passportFormQuery.isLoading),
    hasUnsavedChanges,
  };
}
