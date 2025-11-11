"use client";

import { useImportProgress } from "@/contexts/import-progress-context";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Sheet,
  SheetContent,
  SheetBreadcrumbHeader,
  SheetFooter,
  SheetClose,
} from "@v1/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import * as React from "react";
import { toast } from "sonner";
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
   * Prefetch all tab data when dialog opens
   * This ensures smooth transitions between tabs without loading delays
   */
  React.useEffect(() => {
    if (!jobId || !reviewDialogOpen) return;

    // Prefetch preview data (first page)
    void queryClient.prefetchQuery(
      trpc.bulk.staging.preview.queryOptions({
        jobId,
        limit: 100,
        offset: 0,
      }),
    );

    // Prefetch errors (first page)
    void queryClient.prefetchQuery(
      trpc.bulk.staging.errors.queryOptions({
        jobId,
        limit: 50,
        offset: 0,
      }),
    );

    // Prefetch catalog data for unmapped section
    void queryClient.prefetchQuery(
      trpc.bulk.values.catalogData.queryOptions({ jobId }),
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
      await approveImportMutation.mutateAsync({ jobId });

      toast.success("Import approved! Committing to production...");

      // Close sheet and let the floating widget show progress
      closeReviewDialog();

      // Invalidate queries to refresh status
      await queryClient.invalidateQueries({
        queryKey: trpc.bulk.import.status.queryKey({ jobId }),
      });
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
    <Sheet open={reviewDialogOpen} onOpenChange={closeReviewDialog}>
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
            icon={
              isCancelling ? (
                <Icons.Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.X className="h-4 w-4" />
              )
            }
          >
            Cancel Import
          </Button>

          <Button
            variant="brand"
            size="default"
            onClick={handleApprove}
            disabled={!canApprove || isApproving || isCancelling}
            icon={
              isApproving ? (
                <Icons.Spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.CheckCircle2 className="h-4 w-4" />
              )
            }
          >
            {isApproving ? "Approving..." : "Approve & Import"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
