"use client";

import { useImportProgress } from "@/contexts/import-progress-context";
import {
  PendingEntitiesProvider,
  usePendingEntities,
} from "@/contexts/pending-entities-context";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Sheet,
  SheetBreadcrumbHeader,
  SheetClose,
  SheetContent,
  SheetFooter,
} from "@v1/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import * as React from "react";
import { toast } from "@v1/ui/sonner";
import { ErrorListSection } from "./error-list-section";
import { StagingPreviewTable } from "./staging-preview-table";
import { UnmappedValuesSection } from "./unmapped-values-section";

//===================================================================================
// COMPONENT
//===================================================================================

/**
 * ImportReviewDialog Component (now using Sheet design)
 *
 * Side panel sheet for reviewing staging data before import approval.
 * Displays:
 * - Summary statistics (products to create/update, errors)
 * - Staging data preview table
 * - Validation errors
 * - Unmapped values requiring definition
 * - Action buttons for cancellation and approval
 *
 * Integrates with ImportProgressProvider context and bulk import tRPC endpoints.
 * Redesigned to match the upload sheet pattern for consistent UX.
 */
export function ImportReviewDialog() {
  const { state, reviewDialogOpen, closeReviewDialog, dismissWidget } =
    useImportProgress();

  return (
    <Sheet open={reviewDialogOpen} onOpenChange={closeReviewDialog}>
      <PendingEntitiesProvider>
        <ImportReviewDialogContent
          state={state}
          reviewDialogOpen={reviewDialogOpen}
          closeReviewDialog={closeReviewDialog}
          dismissWidget={dismissWidget}
        />
      </PendingEntitiesProvider>
    </Sheet>
  );
}

/**
 * Inner component that has access to PendingEntitiesProvider
 */
function ImportReviewDialogContent({
  state,
  reviewDialogOpen,
  closeReviewDialog,
  dismissWidget,
}: {
  state: any;
  reviewDialogOpen: boolean;
  closeReviewDialog: () => void;
  dismissWidget: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { getAllPendingEntities, clearPendingEntities, getPendingCount } =
    usePendingEntities();

  const [allValuesDefined, setAllValuesDefined] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  const jobId = state.jobId;

  // Fetch import status for summary stats
  const { data: statusData } = useQuery({
    ...trpc.bulk.import.status.queryOptions({
      jobId: jobId as string,
    }),
    enabled: !!jobId && reviewDialogOpen,
  });

  // Fetch unmapped values to determine if "Define Values" should be shown
  const { data: unmappedData } = useQuery({
    ...trpc.bulk.values.unmapped.queryOptions({
      jobId: jobId as string,
    }),
    enabled: !!jobId && reviewDialogOpen,
  });

  /**
   * Optimized prefetching: Fetch critical data as soon as dialog opens
   * All queries run in parallel for maximum speed
   *
   * NOTE: catalogData and unmapped are already prefetched in ImportProgressContext
   * when validation completes, but we call them again here for redundancy
   */
  React.useEffect(() => {
    if (!jobId || !reviewDialogOpen) return;

    // These are likely already cached from the context prefetch, but ensuring they're ready
    void queryClient.prefetchQuery(
      trpc.bulk.values.catalogData.queryOptions({ jobId }),
    );

    void queryClient.prefetchQuery(
      trpc.bulk.values.unmapped.queryOptions({ jobId }),
    );

    // Prefetch first pages of preview and errors for active tab
    void queryClient.prefetchQuery(
      trpc.bulk.staging.preview.queryOptions({
        jobId,
        limit: 100,
        offset: 0,
      }),
    );

    void queryClient.prefetchQuery(
      trpc.bulk.staging.errors.queryOptions({
        jobId,
        limit: 50,
        offset: 0,
      }),
    );
  }, [jobId, reviewDialogOpen, queryClient, trpc]);

  // Approve import mutation
  const approveImportMutation = useMutation(
    trpc.bulk.import.approve.mutationOptions(),
  );

  // Cancel import mutation
  const cancelImportMutation = useMutation(
    trpc.bulk.import.cancel.mutationOptions(),
  );

  // Individual entity creation mutations
  const createMaterialMutation = useMutation(
    trpc.catalog.materials.create.mutationOptions(),
  );
  const createSeasonMutation = useMutation(
    trpc.catalog.seasons.create.mutationOptions(),
  );
  const createFacilityMutation = useMutation(
    trpc.catalog.facilities.create.mutationOptions(),
  );
  const createManufacturerMutation = useMutation(
    trpc.catalog.manufacturers.create.mutationOptions(),
  );
  const mapToExistingMutation = useMutation(
    trpc.bulk.values.mapToExisting.mutationOptions(),
  );

  // Batch create all pending entities mutation
  const batchCreateEntitiesMutation = useMutation({
    mutationFn: async () => {
      const pending = getAllPendingEntities();

      if (pending.length === 0) {
        return { created: [], failed: [] };
      }

      // Group by entity type
      // Note: SIZE entity type removed - sizes are now managed via generic attributes
      const grouped = {
        MATERIAL: pending.filter((p) => p.entityType === "MATERIAL"),
        SEASON: pending.filter((p) => p.entityType === "SEASON"),
        FACILITY: pending.filter((p) => p.entityType === "FACILITY"),
        MANUFACTURER: pending.filter(
          (p) => p.entityType === "MANUFACTURER",
        ),
      };

      const created: Array<{
        entity: { id: string; name?: string };
        pending: any;
      }> = [];
      const failed: Array<{ pending: any; error: string }> = [];

      // Create all entities in parallel by type
      const createMaterial = async (p: any) => {
        try {
          const result = await createMaterialMutation.mutateAsync(p.entityData);
          const material = result.data;
          if (!material?.id) {
            throw new Error("Material created without identifier");
          }
          created.push({ entity: material, pending: p });
        } catch (err) {
          failed.push({
            pending: p,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      };

      const createSeason = async (p: any) => {
        try {
          const result = await createSeasonMutation.mutateAsync(p.entityData);
          const season = result.data;
          if (!season?.id) {
            throw new Error("Season created without identifier");
          }
          created.push({ entity: season, pending: p });
        } catch (err) {
          failed.push({
            pending: p,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      };

      const createFacility = async (p: any) => {
        try {
          const result = await createFacilityMutation.mutateAsync(p.entityData);
          const facility = result.data;
          if (!facility?.id) {
            throw new Error("Facility created without identifier");
          }
          created.push({ entity: facility, pending: p });
        } catch (err) {
          failed.push({
            pending: p,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      };

      const createManufacturer = async (p: any) => {
        try {
          const result = await createManufacturerMutation.mutateAsync(
            p.entityData,
          );
          const manufacturer = result.data;
          if (!manufacturer?.id) {
            throw new Error("Manufacturer created without identifier");
          }
          created.push({ entity: manufacturer, pending: p });
        } catch (err) {
          failed.push({
            pending: p,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      };

      // Execute all creations in parallel
      // Note: SIZE entity type removed - sizes are now managed via generic attributes
      await Promise.all([
        ...grouped.MATERIAL.map(createMaterial),
        ...grouped.SEASON.map(createSeason),
        ...grouped.FACILITY.map(createFacility),
        ...grouped.MANUFACTURER.map(createManufacturer),
      ]);

      // Now map all created entities to CSV values
      const mappingPromises = created.map(({ entity, pending }) =>
        mapToExistingMutation.mutateAsync({
          jobId,
          entityType: pending.entityType,
          entityId: entity.id,
          rawValue: pending.rawValue,
          sourceColumn: pending.sourceColumn,
        }),
      );

      await Promise.all(mappingPromises);

      return { created, failed };
    },
  });

  const totalUnmapped =
    (unmappedData?.totalUnmapped as number | undefined) ?? 0;

  const summary = statusData?.summary as
    | {
      total?: number;
      valid?: number;
      invalid?: number;
      will_create?: number;
      will_update?: number;
    }
    | undefined;

  const willCreate = summary?.will_create ?? 0;
  const willUpdate = summary?.will_update ?? 0;
  const totalValid = summary?.valid ?? 0;
  const totalErrors = summary?.invalid ?? 0;

  /**
   * Handle import approval
   */
  const handleApprove = async () => {
    if (!jobId) return;

    if (!allValuesDefined && totalUnmapped > 0) {
      toast.error(
        `Please define all ${totalUnmapped} unmapped values before approving`,
      );
      return;
    }

    try {
      setIsApproving(true);

      // STEP 1: Batch create all pending entities and map them
      const pendingCount = getPendingCount();
      if (pendingCount > 0) {
        const result = await toast.loading(
          `Creating ${pendingCount} entities...`,
          batchCreateEntitiesMutation.mutateAsync(),
          {
            errorMessage:
              "Failed to create pending entities. Please review and try again.",
          },
        );

        if (result.failed.length > 0) {
          toast.error(
            `Failed to create ${result.failed.length} entities. Please review and try again.`,
          );
          console.error("Failed entities:", result.failed);
          return;
        }

        toast.success(`Created ${result.created.length} entities successfully`);

        // Clear pending entities after successful creation
        clearPendingEntities();
      }

      // Close sheet immediately BEFORE approving to prevent re-opening
      closeReviewDialog();

      // STEP 2: Approve the import
      await approveImportMutation.mutateAsync({ jobId });

      toast.success("Import approved! Committing to production...");

      // Invalidate queries to refresh status and product data
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.bulk.import.status.queryKey({ jobId }),
        }),
        // Invalidate products list so dashboard/products pages show new imports
        queryClient.invalidateQueries({
          queryKey: trpc.products.list.queryKey(),
        }),
      ]);
    } catch (err) {
      const error = err as Error;
      toast.error(
        error.message || "Failed to approve import. Please try again.",
      );
      console.error("Approve error:", err);
    } finally {
      setIsApproving(false);
    }
  };

  /**
   * Handle import cancellation
   */
  const handleCancel = async () => {
    if (!jobId) return;

    try {
      setIsCancelling(true);
      await cancelImportMutation.mutateAsync({ jobId });

      toast.success("Import cancelled. Staging data discarded.");

      // Clear pending entities
      clearPendingEntities();

      // Close sheet and dismiss widget
      closeReviewDialog();
      dismissWidget();

      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: trpc.bulk.import.status.queryKey({ jobId }),
      });
    } catch (err) {
      const error = err as Error;
      toast.error(
        error.message || "Failed to cancel import. Please try again.",
      );
      console.error("Cancel error:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Reset step when sheet opens
  React.useEffect(() => {
    if (reviewDialogOpen) {
      setCurrentStep(0);
    }
  }, [reviewDialogOpen]);

  if (!jobId) return null;

  const canApprove = allValuesDefined || totalUnmapped === 0;

  // Breadcrumb pages for navigation
  const breadcrumbPages = ["Review Import"];

  return (
    <SheetContent
      side="right"
      className="flex flex-col p-0 gap-0 w-full sm:w-[680px] lg:w-[800px] xl:w-[920px] m-6 h-[calc(100vh-48px)]"
      hideDefaultClose
    >
      <SheetBreadcrumbHeader
        pages={breadcrumbPages}
        currentPageIndex={currentStep}
      />

      {/* Summary Stats */}
      <div className="px-6 py-4 border-b border-border bg-accent/30">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Valid */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <div className="rounded-md bg-accent p-2">
              <Icons.CheckCircle2 className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <div className="text-xl font-semibold">{totalValid}</div>
              <div className="text-xs text-secondary">Valid</div>
            </div>
          </div>

          {/* Will Create */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <div className="rounded-md bg-accent p-2">
              <Icons.Plus className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <div className="text-xl font-semibold">{willCreate}</div>
              <div className="text-xs text-secondary">Create</div>
            </div>
          </div>

          {/* Will Update */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <div className="rounded-md bg-accent p-2">
              <Icons.RefreshCw className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <div className="text-xl font-semibold">{willUpdate}</div>
              <div className="text-xs text-secondary">Update</div>
            </div>
          </div>

          {/* Errors */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <div className="rounded-md bg-accent p-2">
              <Icons.AlertCircle className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <div className="text-xl font-semibold">{totalErrors}</div>
              <div className="text-xs text-secondary">Errors</div>
            </div>
          </div>
        </div>

        {/* Unmapped values warning */}
        {totalUnmapped > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2">
              <Icons.AlertTriangle className="h-4 w-4 text-amber-700" />
              <div className="flex-1">
                <div className="text-sm font-medium text-amber-900">
                  {totalUnmapped} unmapped{" "}
                  {totalUnmapped === 1 ? "value" : "values"} need definition
                </div>
                <div className="text-xs text-amber-700">
                  Define all values before approving the import
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content area with tabs */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <Tabs defaultValue="preview" className="h-full flex flex-col">
          <TabsList className="grid grid-cols-3 w-full max-w-md mb-4">
            <TabsTrigger
              value="preview"
              className="text-xs text-foreground data-[state=inactive]:text-foreground"
            >
              Preview ({totalValid})
            </TabsTrigger>
            <TabsTrigger
              value="errors"
              className="text-xs text-foreground data-[state=inactive]:text-foreground"
            >
              Errors ({totalErrors})
            </TabsTrigger>
            <TabsTrigger
              value="unmapped"
              className="text-xs text-foreground data-[state=inactive]:text-foreground"
            >
              Unmapped ({totalUnmapped})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto -mx-6 px-6">
            <TabsContent value="preview" className="mt-0 h-full">
              <StagingPreviewTable jobId={jobId} />
            </TabsContent>

            <TabsContent value="errors" className="mt-0 h-full">
              <ErrorListSection jobId={jobId} />
            </TabsContent>

            <TabsContent value="unmapped" className="mt-0 h-full">
              <UnmappedValuesSection
                jobId={jobId}
                onAllValuesDefined={setAllValuesDefined}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Footer with action buttons */}
      <SheetFooter className="border-t border-border">
        <Button
          variant="outline"
          size="default"
          onClick={handleCancel}
          disabled={isCancelling || isApproving}
        >
          <span className="px-1">Cancel Import</span>
          {isCancelling ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <Icons.X className="h-4 w-4" />}
        </Button>

        <Button
          variant="brand"
          size="default"
          onClick={handleApprove}
          disabled={!canApprove || isApproving || isCancelling}
        >
          <span className="px-1">{isApproving ? "Approving..." : "Approve & Import"}</span>
          {isApproving ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <Icons.CheckCircle2 className="h-4 w-4" />}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
