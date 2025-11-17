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
  title: string;
  description: string;
  imageFile: File | null;
  existingImageUrl: string | null;

  // Organization
  categoryId: string | null;
  season: string | null;
  tagIds: string[];

  // Identifiers
  articleNumber: string;
  ean: string;
  showcaseBrandId: string | null;

  // Variant
  colorIds: string[];
  pendingColors: PendingColorSelection[];
  selectedSizes: TierTwoSizeOption[];

  // Materials
  materialData: Array<{ materialId: string; percentage: number }>;

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
  productUpid?: string;
  sizeOptions?: TierTwoSizeOption[];
  colors?: Array<{ id: string; name: string; hex: string }>;
}

const initialFormValues: PassportFormValues = {
  title: "",
  description: "",
  imageFile: null,
  existingImageUrl: null,
  categoryId: null,
  season: null,
  tagIds: [],
  articleNumber: "",
  ean: "",
  showcaseBrandId: null,
  colorIds: [],
  pendingColors: [],
  selectedSizes: [],
  materialData: [],
  journeySteps: [],
  carbonKgCo2e: "",
  waterLiters: "",
  status: "unpublished",
};

export interface PassportFormValidationErrors {
  title?: string;
  articleNumber?: string;
  ean?: string;
  description?: string;
  colors?: string;
  selectedSizes?: string;
  materials?: string;
  carbonKgCo2e?: string;
  waterLiters?: string;
}

type PassportFormValidationFields = Pick<
  PassportFormValues,
  | "title"
  | "articleNumber"
  | "ean"
  | "description"
  | "colorIds"
  | "selectedSizes"
  | "materialData"
  | "carbonKgCo2e"
  | "waterLiters"
>;

const passportFormSchema: ValidationSchema<PassportFormValidationFields> = {
  title: [
    rules.required("Title is required"),
    rules.maxLength(100, "Title must be 100 characters or less"),
  ],
  articleNumber: [
    rules.required("Article number is required"),
    rules.maxLength(100, "Article number must be 100 characters or less"),
  ],
  ean: [rules.ean()],
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

  if (errors.title) mapped.title = errors.title;
  if (errors.articleNumber) mapped.articleNumber = errors.articleNumber;
  if (errors.ean) mapped.ean = errors.ean;
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
    title: values.title,
    articleNumber: values.articleNumber,
    ean: values.ean,
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

  const createPassportWorkflowMutation = useMutation(
    trpc.composite.passportCreate.mutationOptions(),
  );

  const updatePassportWorkflowMutation = useMutation(
    trpc.composite.passportUpdate.mutationOptions(),
  );

  const createBrandColorMutation = useMutation(
    trpc.brand.colors.create.mutationOptions(),
  );

  const passportFormQuery = useQuery({
    ...trpc.composite.passportForm.queryOptions({
      product_upid: productUpid ?? "",
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
      title: values.title,
      description: values.description,
      categoryId: values.categoryId,
      season: values.season,
      tagIds: values.tagIds,
      articleNumber: values.articleNumber,
      ean: values.ean,
      showcaseBrandId: values.showcaseBrandId,
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
    const payload = passportFormQuery.data;
    if ((payload.sizeIds?.length ?? 0) > 0 && sizeOptions.length === 0) {
      return;
    }
    const selectedSizes = mapSizeIdsToOptions(payload.sizeIds);
    const nextValues: PassportFormValues = {
      ...initialFormValues,
      title: payload.title ?? "",
      description: payload.description ?? "",
      imageFile: null,
      existingImageUrl: payload.primaryImageUrl ?? null,
      categoryId: payload.categoryId ?? null,
      season: payload.season ?? null,
      tagIds: payload.tagIds ?? [],
      articleNumber: payload.productIdentifier ?? "",
      ean: payload.ean ?? "",
      showcaseBrandId: payload.showcaseBrandId ?? null,
      colorIds: payload.colorIds ?? [],
      pendingColors: [],
      selectedSizes,
      materialData: (payload.materials ?? []).map((material) => ({
        materialId: material.brandMaterialId,
        percentage: material.percentage,
      })),
      journeySteps: payload.journeySteps ?? [],
      carbonKgCo2e: payload.environment?.carbonKgCo2e ?? "",
      waterLiters: payload.environment?.waterLiters ?? "",
      status: payload.status ?? "unpublished",
    };
    setFields(nextValues);
    metadataRef.current = {
      productId: payload.productId,
      passportUpid: payload.passportUpid,
      productUpid: payload.productUpid,
    };
    const snapshot = JSON.stringify(computeComparableState(nextValues));
    setInitialSnapshot(snapshot);
    setHasAttemptedSubmit(false);
    hasHydratedRef.current = true;
  }, [
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
  }, [computeComparableState, formValues, initialSnapshot, isEditMode]);

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
        trpc.composite.passportFormReferences.queryKey(),
        (old: any) => {
          if (!old?.brandCatalog?.colors) {
            return old;
          }
          const existingNames = new Set(
            old.brandCatalog.colors.map((color: any) =>
              color.name.toLowerCase(),
            ),
          );
          const appended = createdColorMetadata.filter(
            (color) => !existingNames.has(color.name.toLowerCase()),
          );
          if (appended.length === 0) {
            return old;
          }
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              colors: [...old.brandCatalog.colors, ...appended],
            },
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: trpc.composite.passportFormReferences.queryKey(),
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
    trpc.composite.passportFormReferences,
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
        const title = formValues.title?.trim();
        if (!title) {
          throw new Error("Title is required");
        }

        const articleNumber = formValues.articleNumber?.trim();
        if (!articleNumber) {
          throw new Error("Article number is required");
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
              `Failed to upload image: ${
                err instanceof Error ? err.message : "Unknown error"
              }`,
            );
          }
        }

        const safeDescription = formValues.description.trim() || undefined;
        const safeSeason = formValues.season?.trim() || undefined;
        const safeShowcaseBrandId = formValues.showcaseBrandId || undefined;
        const safeProductIdentifier =
          formValues.articleNumber.trim() || undefined;
        const ean = formValues.ean.trim() || undefined;
        const resolvedColorIds = await resolvePendingColors();
        const colorIds =
          resolvedColorIds.length > 0 ? resolvedColorIds : undefined;
        const sizeIds = formValues.selectedSizes
          .map((size) => size.id)
          .filter((id): id is string => Boolean(id));
        const tags =
          formValues.tagIds.length > 0
            ? formValues.tagIds
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0)
            : undefined;
        const materials =
          formValues.materialData.length > 0
            ? formValues.materialData.map((material) => ({
                brand_material_id: material.materialId,
                percentage: material.percentage,
              }))
            : undefined;
        const journeySteps =
          formValues.journeySteps.length > 0
            ? formValues.journeySteps.map((step) => ({
                sort_index: step.sortIndex,
                step_type: step.stepType,
                facility_id: step.facilityId,
              }))
            : undefined;
        const environmentPayload =
          formValues.carbonKgCo2e.trim() || formValues.waterLiters.trim()
            ? {
                carbon_kg_co2e: formValues.carbonKgCo2e.trim() || undefined,
                water_liters: formValues.waterLiters.trim() || undefined,
              }
            : undefined;

        if (isEditMode) {
          const effectiveProductUpid =
            productUpid ?? metadataRef.current.productUpid ?? null;
          if (!metadataRef.current.productId || !effectiveProductUpid) {
            throw new Error("Unable to update passport: missing context");
          }

          await updatePassportWorkflowMutation.mutateAsync({
            product_upid: effectiveProductUpid,
            product_id: metadataRef.current.productId,
            title,
            product_identifier: safeProductIdentifier ?? articleNumber,
            description: safeDescription,
            category_id: formValues.categoryId ?? undefined,
            season: safeSeason,
            showcase_brand_id: safeShowcaseBrandId,
            primary_image_url:
              primaryImageUrl ?? formValues.existingImageUrl ?? undefined,
            tags: tags ?? [],
            sku: articleNumber,
            ean,
            color_ids: colorIds,
            size_ids: sizeIds.length > 0 ? sizeIds : undefined,
            status: (formValues.status ||
              "unpublished") as
              | "published"
              | "scheduled"
              | "unpublished"
              | "archived",
            materials: materials ?? [],
            journey_steps: journeySteps ?? [],
            environment: environmentPayload,
          });

          const nextValues: Partial<PassportFormValues> = {
            title,
            description: safeDescription ?? "",
            season: safeSeason ?? null,
            showcaseBrandId: safeShowcaseBrandId ?? null,
            articleNumber,
            ean: ean ?? "",
            imageFile: null,
            existingImageUrl:
              primaryImageUrl ?? formValues.existingImageUrl ?? null,
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
          const passportSlug = metadataRef.current.passportUpid;
          if (passportSlug) {
            void queryClient.invalidateQueries({
              queryKey: trpc.passports.get.queryKey({ upid: passportSlug }),
            });
          }
          if (effectiveProductUpid) {
            void queryClient.invalidateQueries({
              queryKey: trpc.composite.passportForm.queryKey({
                product_upid: effectiveProductUpid,
              }),
            });
          }
          toast.success("Passport updated successfully");
          return;
        }

        const workflowResult =
          await createPassportWorkflowMutation.mutateAsync({
            title,
            sku: articleNumber,
            product_identifier: safeProductIdentifier,
            description: safeDescription,
            category_id: formValues.categoryId ?? undefined,
            season: safeSeason,
            showcase_brand_id: safeShowcaseBrandId,
            primary_image_url: primaryImageUrl,
            tags,
            ean,
            color_ids: colorIds,
            size_ids: sizeIds.length > 0 ? sizeIds : undefined,
            status: (formValues.status ||
              "unpublished") as
              | "published"
              | "scheduled"
              | "unpublished"
              | "archived",
            template_id: undefined,
            materials,
            journey_steps: journeySteps,
            environment: environmentPayload,
          });

        const workflowData = workflowResult?.data;
        const targetProductUpid =
          workflowData?.productUpid ??
          (workflowData as any)?.product_upid;
        if (!targetProductUpid) {
          throw new Error("Passport workflow did not return a product UPID");
        }

        void Promise.allSettled([
          queryClient.invalidateQueries({
            queryKey: trpc.passports.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.products.list.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.composite.passportFormReferences.queryKey(),
          }),
        ]);

        toast.success("Passports created successfully");
        router.push(`/passports/edit/${targetProductUpid}`);

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
      computeComparableState,
      formValues,
      isEditMode,
      metadataRef,
      queryClient,
      router,
      trpc,
      updatePassportWorkflowMutation,
      uploadFile,
      validate,
      createPassportWorkflowMutation,
      productUpid,
      resolvePendingColors,
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

