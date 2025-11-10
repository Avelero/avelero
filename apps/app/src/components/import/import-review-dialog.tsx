"use client";

import { useImportProgress } from "@/contexts/import-progress-context";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
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
 * ImportReviewDialog Component
 *
 * Full-screen dialog for reviewing staging data before import approval.
 * Displays:
 * - Summary statistics (products to create/update, errors)
 * - Staging data preview table
 * - Validation errors
 * - Unmapped values requiring definition
 * - Action buttons for cancellation and approval
 *
 * Integrates with ImportProgressProvider context and bulk import tRPC endpoints.
 */
export function ImportReviewDialog() {
  const { state, reviewDialogOpen, closeReviewDialog, dismissWidget } =
    useImportProgress();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [allValuesDefined, setAllValuesDefined] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);

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

      // Close dialog and let the floating widget show progress
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

      // Close dialog and dismiss widget
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

  if (!jobId) return null;

  const canApprove = allValuesDefined || totalUnmapped === 0;

  return (
    <Dialog open={reviewDialogOpen} onOpenChange={closeReviewDialog}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-xl">Review Import</DialogTitle>
          <DialogDescription>
            Review the staging data and approve to commit to production
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="px-6 py-4 border-b border-border bg-accent/30">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Valid */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <div className="rounded-md bg-green-100 p-2">
                <Icons.CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{totalValid}</div>
                <div className="text-xs text-secondary">Valid products</div>
              </div>
            </div>

            {/* Will Create */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <div className="rounded-md bg-blue-100 p-2">
                <Icons.Plus className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{willCreate}</div>
                <div className="text-xs text-secondary">Will create</div>
              </div>
            </div>

            {/* Will Update */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <div className="rounded-md bg-purple-100 p-2">
                <Icons.RefreshCw className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{willUpdate}</div>
                <div className="text-xs text-secondary">Will update</div>
              </div>
            </div>

            {/* Errors */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
              <div
                className={cn(
                  "rounded-md p-2",
                  totalErrors > 0 ? "bg-destructive/20" : "bg-accent",
                )}
              >
                <Icons.AlertCircle
                  className={cn(
                    "h-5 w-5",
                    totalErrors > 0 ? "text-destructive" : "text-secondary",
                  )}
                />
              </div>
              <div>
                <div className="text-2xl font-semibold">{totalErrors}</div>
                <div className="text-xs text-secondary">Errors</div>
              </div>
            </div>
          </div>

          {/* Unmapped values warning */}
          {totalUnmapped > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2">
                <Icons.AlertTriangle className="h-5 w-5 text-amber-700" />
                <div>
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

        {/* Tabs for different sections */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="preview" className="h-full flex flex-col">
            <div className="px-6 border-b border-border">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="preview">
                  Preview ({totalValid})
                </TabsTrigger>
                <TabsTrigger value="errors">Errors ({totalErrors})</TabsTrigger>
                <TabsTrigger value="unmapped">
                  Unmapped ({totalUnmapped})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto">
              <TabsContent value="preview" className="p-6 mt-0">
                <StagingPreviewTable jobId={jobId} />
              </TabsContent>

              <TabsContent value="errors" className="p-6 mt-0">
                <ErrorListSection jobId={jobId} />
              </TabsContent>

              <TabsContent value="unmapped" className="p-6 mt-0">
                <UnmappedValuesSection
                  jobId={jobId}
                  onAllValuesDefined={setAllValuesDefined}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-border bg-accent/30">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
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

            <div className="flex items-center gap-3">
              <Button
                variant="default"
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
                Approve & Import
              </Button>
            </div>
          </div>

          {!canApprove && totalUnmapped > 0 && (
            <div className="mt-3 text-xs text-secondary text-right">
              Define all unmapped values to enable approval
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
