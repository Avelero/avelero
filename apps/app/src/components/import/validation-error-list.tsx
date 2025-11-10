"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface ValidationError {
  type: string;
  message: string;
  row?: number;
  column?: string;
}

interface ValidationErrorListProps {
  errors: ValidationError[];
  className?: string;
}

export function ValidationErrorList({
  errors,
  className,
}: ValidationErrorListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!errors || errors.length === 0) {
    return null;
  }

  const errorCount = errors.length;
  const displayErrors = showAll ? errors : errors.slice(0, 3);
  const hasMore = errors.length > 3;

  return (
    <div
      className={cn(
        "mt-3 rounded-md bg-destructive/10 border border-destructive/20",
        className,
      )}
    >
      {/* Error Summary Header */}
      <div className="flex items-start gap-3 p-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">
            {errorCount} {errorCount === 1 ? "error" : "errors"} must be fixed
            before proceeding
          </p>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 text-xs text-destructive/80 hover:text-destructive underline-offset-2 hover:underline inline-flex items-center gap-1"
            type="button"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show error details
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Details List */}
      {isExpanded && (
        <div className="border-t border-destructive/20 p-3 space-y-3">
          {displayErrors.map((error, index) => {
            // Create a unique key based on error content
            const errorKey = `${error.type}-${error.row || 0}-${error.column || ""}-${index}`;
            return (
              <div
                key={errorKey}
                className="text-xs space-y-1 pb-3 last:pb-0 border-b last:border-b-0 border-destructive/10"
              >
                <div className="flex items-start gap-2">
                  <span className="font-medium text-destructive">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    {error.row !== undefined && (
                      <span className="font-medium text-destructive">
                        Row {error.row}
                        {error.column ? `, Column "${error.column}"` : ""}:
                      </span>
                    )}
                    <p className="text-destructive/90 mt-0.5">
                      {error.message}
                    </p>
                    {error.type && (
                      <p className="text-destructive/60 text-[10px] mt-1 font-mono">
                        Error type: {error.type}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && !showAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(true)}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
              type="button"
            >
              Show all {errorCount} errors
            </Button>
          )}

          {showAll && hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(false)}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
              type="button"
            >
              Show less
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
