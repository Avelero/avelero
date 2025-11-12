"use client";

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
import { Progress } from "@v1/ui/progress";
import * as React from "react";

/**
 * Batch operation result for a single item
 */
export interface BatchItemResult {
  rawValue: string;
  success: boolean;
  error?: string;
}

/**
 * Props for UnmappedBatchProgressModal component
 */
interface UnmappedBatchProgressModalProps {
  /** Controls modal visibility */
  open: boolean;
  /** Entity type being processed (for display) */
  entityType: string;
  /** Total number of items to process */
  total: number;
  /** Number of items completed */
  completed: number;
  /** Number of items that succeeded */
  succeeded: number;
  /** Number of items that failed */
  failed: number;
  /** Detailed results for each item */
  results: BatchItemResult[];
  /** Whether processing is complete */
  isComplete: boolean;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * UnmappedBatchProgressModal Component
 *
 * Shows real-time progress when batch creating/mapping multiple unmapped values.
 * Displays:
 * - Progress bar
 * - Success/failure counts
 * - Detailed list of processed items with status
 *
 * @example
 * ```tsx
 * <UnmappedBatchProgressModal
 *   open={isProcessing}
 *   entityType="MATERIAL"
 *   total={5}
 *   completed={3}
 *   succeeded={2}
 *   failed={1}
 *   results={results}
 *   isComplete={false}
 *   onClose={() => setIsProcessing(false)}
 * />
 * ```
 */
export function UnmappedBatchProgressModal({
  open,
  entityType,
  total,
  completed,
  succeeded,
  failed,
  results,
  isComplete,
  onClose,
}: UnmappedBatchProgressModalProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => !newOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isComplete
              ? "Batch Operation Complete"
              : `Processing ${entityType}s...`}
          </DialogTitle>
          <DialogDescription>
            {isComplete
              ? `Processed ${total} ${entityType.toLowerCase()}${total !== 1 ? "s" : ""}`
              : `Creating and mapping ${entityType.toLowerCase()}s from your import`}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {completed} of {total}
            </span>
            <span className="text-secondary">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-accent/30 p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-blue-100 p-1.5">
                <Icons.Package className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{completed}</div>
                <div className="text-xs text-secondary">Processed</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-accent/30 p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-green-100 p-1.5">
                <Icons.CheckCircle2 className="h-4 w-4 text-green-700" />
              </div>
              <div>
                <div className="text-2xl font-semibold">{succeeded}</div>
                <div className="text-xs text-secondary">Succeeded</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-accent/30 p-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "rounded-md p-1.5",
                  failed > 0 ? "bg-destructive/20" : "bg-accent",
                )}
              >
                <Icons.AlertCircle
                  className={cn(
                    "h-4 w-4",
                    failed > 0 ? "text-destructive" : "text-secondary",
                  )}
                />
              </div>
              <div>
                <div className="text-2xl font-semibold">{failed}</div>
                <div className="text-xs text-secondary">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Details</div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-background">
              <div className="divide-y divide-border">
                {results.map((result, index) => (
                  <div
                    key={`${result.rawValue}-${index}`}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {result.success ? (
                        <Icons.CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <Icons.X className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {result.rawValue}
                        </div>
                        {result.error && (
                          <div className="text-xs text-destructive truncate">
                            {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full",
                        result.success
                          ? "bg-green-100 text-green-700"
                          : "bg-destructive/20 text-destructive",
                      )}
                    >
                      {result.success ? "Success" : "Failed"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          {isComplete ? (
            <Button variant="brand" size="default" onClick={onClose}>
              Close
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-secondary">
              <Icons.Spinner className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
