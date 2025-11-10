"use client";

import { useImportProgress } from "@/contexts/import-progress-context";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CircularProgress } from "./circular-progress";

//===================================================================================
// TYPES
//===================================================================================

type WidgetState = "collapsed" | "expanded";

//===================================================================================
// UTILITY FUNCTIONS
//===================================================================================

/**
 * Get human-readable status text for display
 */
function getStatusText(
  status: string | null,
  current: number,
  total: number,
): string {
  switch (status) {
    case "PENDING":
      return "Processing products...";
    case "VALIDATING":
      return `Processing products... ${current.toLocaleString()} / ${total.toLocaleString()}`;
    case "VALIDATED":
      return "Ready for review";
    case "COMMITTING":
      return `Importing - ${current.toLocaleString()} / ${total.toLocaleString()} products`;
    case "COMPLETED":
      return "Import complete";
    case "FAILED":
      return "Import failed";
    case "CANCELLED":
      return "Import cancelled";
    default:
      return "Processing...";
  }
}

/**
 * Get status-specific styling
 */
function getStatusColor(status: string | null): string {
  switch (status) {
    case "COMPLETED":
      return "text-green-600 dark:text-green-400";
    case "FAILED":
    case "CANCELLED":
      return "text-destructive";
    case "VALIDATED":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-primary";
  }
}

//===================================================================================
// COMPONENT
//===================================================================================

export function FloatingProgressWidget() {
  const { state, dismissWidget, openReviewDialog } = useImportProgress();
  const [widgetState, setWidgetState] = useState<WidgetState>("collapsed");
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render if no active import
  if (!state.jobId || !state.status) {
    return null;
  }

  // Don't render on server
  if (!mounted) {
    return null;
  }

  const isExpanded = widgetState === "expanded";
  const isClickable = state.status === "VALIDATED";

  /**
   * Toggle between collapsed and expanded states
   */
  const toggleExpand = () => {
    if (isClickable && !isExpanded) {
      // If status is VALIDATED, open review dialog instead of expanding
      openReviewDialog();
    } else {
      setWidgetState((prev) =>
        prev === "collapsed" ? "expanded" : "collapsed",
      );
    }
  };

  /**
   * Handle dismiss button click
   */
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissWidget();
  };

  const statusText = getStatusText(
    state.status,
    state.progress.current,
    state.progress.total,
  );
  const statusColor = getStatusColor(state.status);

  const widget = (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 ease-in-out",
        // Mobile: smaller and adjust position
        "bottom-4 right-4 md:bottom-6 md:right-6",
        // Prevent layout shift
        "pointer-events-auto",
      )}
      role="status"
      aria-live="polite"
      aria-label="Import progress"
    >
      <div
        className={cn(
          "bg-background border border-border rounded-lg shadow-lg",
          "transition-all duration-300 ease-in-out",
          isExpanded ? "w-80" : "w-auto",
        )}
      >
        {/* Header / Collapsed View */}
        <div
          className={cn(
            "flex items-center gap-3 p-3",
            isClickable && !isExpanded && "cursor-pointer hover:bg-accent/50",
          )}
          onClick={isClickable && !isExpanded ? toggleExpand : undefined}
        >
          {/* Circular Progress */}
          <div className="flex-shrink-0">
            <CircularProgress
              percentage={state.progress.percentage}
              size={40}
              strokeWidth={3}
            />
          </div>

          {/* Status Text */}
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium truncate", statusColor)}>
              {statusText}
            </p>
            {!isExpanded && state.filename && (
              <p className="text-xs text-muted-foreground truncate">
                {state.filename}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isExpanded && state.status !== "VALIDATED" && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand();
                }}
                aria-label="Expand details"
              >
                <Icons.ChevronDown className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <Icons.X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="border-t border-border p-3 space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">File:</span>
                <span className="font-medium truncate ml-2">
                  {state.filename}
                </span>
              </div>

              {state.progress.total > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-medium">
                      {state.progress.current.toLocaleString()} /{" "}
                      {state.progress.total.toLocaleString()}
                    </span>
                  </div>

                  {state.progress.created > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Created:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {state.progress.created.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {state.progress.updated > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {state.progress.updated.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {state.progress.failed > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="font-medium text-destructive">
                        {state.progress.failed.toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {state.status === "VALIDATED" && (
              <Button
                variant="brand"
                size="sm"
                className="w-full"
                onClick={openReviewDialog}
              >
                Review & Approve
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={toggleExpand}
            >
              <Icons.ChevronDown className="h-4 w-4 rotate-180" />
              <span className="ml-1">Collapse</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Render using portal to document.body
  return createPortal(widget, document.body);
}

FloatingProgressWidget.displayName = "FloatingProgressWidget";
