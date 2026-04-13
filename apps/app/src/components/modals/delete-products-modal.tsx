/**
 * Product delete confirmation modal.
 *
 * Uses a single modal-based loading state for both synchronous deletes and
 * background Trigger.dev deletes, without separate progress UI.
 */
"use client";

import { useTriggerRunStatus } from "@/hooks/use-job-progress";
import type { FilterState } from "@/components/passports/filter-types";
import type { SelectionState } from "@/components/tables/passports/types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { useEffect, useState } from "react";

interface DeleteProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selection state for bulk operations. */
  selection: SelectionState;
  /** Current filter state used when selection.mode === "all". */
  filterState?: FilterState;
  /** Current search term used when selection.mode === "all". */
  search?: string;
  /** Total count of products to be deleted. */
  totalCount: number;
  /** Optional callback after successful deletion. */
  onSuccess?: () => void;
}

type DeleteState = "initial" | "deleting" | "failed";

/**
 * Render and drive the unified product delete flow.
 */
function DeleteProductsModal({
  open,
  onOpenChange,
  selection,
  filterState,
  search,
  totalCount,
  onSuccess,
}: DeleteProductsModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [deleteState, setDeleteState] = useState<DeleteState>("initial");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeAccessToken, setActiveAccessToken] = useState<string | null>(
    null,
  );
  const [sawFallbackActiveJob, setSawFallbackActiveJob] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBulk = totalCount > 1;
  const count = totalCount;
  const isSingleExplicit =
    selection.mode === "explicit" && selection.includeIds.length === 1;
  const willRunAsync =
    selection.mode === "all" ||
    (selection.mode === "explicit" && selection.includeIds.length > 100);

  /**
   * Start the unified delete endpoint.
   */
  const deleteMutation = useMutation(trpc.products.delete.mutationOptions());

  /**
   * Subscribe to Trigger.dev realtime completion for background deletes.
   */
  const { runStatus, error: realtimeError } = useTriggerRunStatus(
    activeRunId,
    activeAccessToken,
  );

  /**
   * Silently fall back to the existing active-job endpoint if a realtime token is unavailable.
   */
  const activeDeleteJobQuery = useQuery({
    ...trpc.products.getActiveDeleteJob.queryOptions(),
    enabled:
      open &&
      deleteState === "deleting" &&
      activeJobId !== null &&
      activeAccessToken === null,
    retry: false,
    refetchInterval: 1000,
  });

  /**
   * Reset local modal state after the close animation finishes.
   */
  function resetState() {
    setDeleteState("initial");
    setActiveJobId(null);
    setActiveRunId(null);
    setActiveAccessToken(null);
    setSawFallbackActiveJob(false);
    setErrorMessage(null);
    deleteMutation.reset();
  }

  /**
   * Reset the modal after it fully closes, regardless of which path triggered the close.
   */
  useEffect(() => {
    if (open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      resetState();
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  /**
   * Refetch the active delete-adjacent queries before the modal closes.
   */
  async function refreshActiveDeleteQueries() {
    await Promise.all([
      queryClient.refetchQueries(
        {
          queryKey: [["products", "list"]],
          type: "active",
        },
        {
          cancelRefetch: true,
        },
      ),
      queryClient.refetchQueries(
        {
          queryKey: [["summary"]],
          type: "active",
        },
        {
          cancelRefetch: true,
        },
      ),
      queryClient.refetchQueries(
        {
          queryKey: trpc.brand.billing.getStatus.queryKey(),
          type: "active",
        },
        {
          cancelRefetch: true,
        },
      ),
      queryClient.refetchQueries(
        {
          queryKey: trpc.composite.initDashboard.queryKey(),
          type: "active",
        },
        {
          cancelRefetch: true,
        },
      ),
      queryClient.refetchQueries(
        {
          queryKey: trpc.products.getActiveDeleteJob.queryKey(),
          type: "active",
        },
        {
          cancelRefetch: true,
        },
      ),
      queryClient.invalidateQueries({
        queryKey: [["products", "list"]],
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: [["summary"]],
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.brand.billing.getStatus.queryKey(),
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.composite.initDashboard.queryKey(),
        refetchType: "none",
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.products.getActiveDeleteJob.queryKey(),
        refetchType: "none",
      }),
    ]);
  }

  /**
   * Finalize a successful delete and close the modal.
   */
  async function finishDelete() {
    await refreshActiveDeleteQueries();
    onSuccess?.();
    onOpenChange(false);
  }

  /**
   * React to Trigger.dev realtime completion for background deletes.
   */
  useEffect(() => {
    if (deleteState !== "deleting" || activeRunId === null) {
      return;
    }

    if (realtimeError) {
      setActiveRunId(null);
      setActiveAccessToken(null);
      return;
    }

    if (runStatus === "completed") {
      void finishDelete();
      return;
    }

    if (runStatus === "failed" || runStatus === "cancelled") {
      setErrorMessage("Failed to delete products");
      setDeleteState("failed");
    }
  }, [activeRunId, deleteState, realtimeError, runStatus]);

  /**
   * Close the modal once the fallback active-job signal disappears.
   */
  useEffect(() => {
    if (
      deleteState !== "deleting" ||
      activeJobId === null ||
      activeAccessToken !== null
    ) {
      return;
    }

    if (activeDeleteJobQuery.data?.id === activeJobId) {
      setSawFallbackActiveJob(true);
      return;
    }

    if (sawFallbackActiveJob && activeDeleteJobQuery.data === null) {
      void finishDelete();
    }
  }, [
    activeAccessToken,
    activeDeleteJobQuery.data,
    activeJobId,
    deleteState,
    sawFallbackActiveJob,
  ]);

  /**
   * Keep the modal open while deletion is in flight.
   */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && deleteState === "deleting") {
      return;
    }

    onOpenChange(nextOpen);
  }

  /**
   * Submit the delete request and transition into the waiting state.
   */
  function handleDelete() {
    if (
      deleteMutation.isPending ||
      deleteState === "deleting" ||
      totalCount === 0
    ) {
      return;
    }

    setDeleteState("deleting");
    setActiveJobId(null);
    setActiveRunId(null);
    setActiveAccessToken(null);
    setSawFallbackActiveJob(false);
    setErrorMessage(null);

    const mutationInput = isSingleExplicit
      ? { id: selection.includeIds[0]! }
      : selection.mode === "all"
        ? {
            selection: {
              mode: "all" as const,
              filters: filterState?.groups.length ? filterState : undefined,
              search: search?.trim() || undefined,
              excludeIds:
                selection.excludeIds.length > 0
                  ? selection.excludeIds
                  : undefined,
            },
          }
        : {
            selection: {
              mode: "explicit" as const,
              ids: selection.includeIds,
            },
          };

    deleteMutation.mutate(mutationInput, {
      onSuccess: (result) => {
        if (result.mode === "sync") {
          void finishDelete();
          return;
        }

        setActiveJobId(result.jobId);
        setActiveRunId(result.runId);
        setActiveAccessToken(result.publicAccessToken ?? null);
      },
      onError: (error) => {
        setErrorMessage(error.message || "Failed to delete products");
        setDeleteState("failed");
      },
    });
  }

  /**
   * Retry the same delete flow after a failure.
   */
  function handleRetry() {
    resetState();
    setTimeout(handleDelete, 0);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="md"
        className={`p-0 gap-0 ${deleteState === "deleting" ? "[&>button.absolute]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (deleteState === "deleting") {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (deleteState === "deleting") {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            {deleteState === "failed"
              ? "Delete failed"
              : isBulk
                ? `Delete ${count} products?`
                : "Delete product?"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          {deleteState === "initial" && (
            <div className="space-y-4">
              <DialogDescription className="text-secondary">
                {isBulk
                  ? `This will permanently delete ${count} products and all their associated data.`
                  : "This will permanently delete this product and all its associated data."}
              </DialogDescription>
              <DialogDescription className="text-secondary">
                {willRunAsync
                  ? "Large deletions may take a little longer to finish. This action cannot be undone."
                  : "This action cannot be undone."}
              </DialogDescription>
            </div>
          )}

          {deleteState === "deleting" && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 py-6">
              <Icons.Loader className="h-5 w-5 animate-spin text-tertiary" />
              <p className="type-small text-foreground">
                {isBulk ? "Deleting products..." : "Deleting product..."}
              </p>
            </div>
          )}

          {deleteState === "failed" && (
            <div className="flex flex-col items-center justify-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Icons.AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="type-small text-secondary">
                  {errorMessage || "Failed to delete products"}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          {deleteState === "failed" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRetry}
              >
                Try again
              </Button>
            </>
          ) : deleteState === "deleting" ? (
            <Button type="button" variant="destructive" disabled>
              {isBulk ? "Deleting products..." : "Deleting product..."}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || totalCount === 0}
              >
                {deleteMutation.isPending
                  ? "Deleting..."
                  : isBulk
                    ? `Delete ${count} products`
                    : "Delete"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteProductsModal };
