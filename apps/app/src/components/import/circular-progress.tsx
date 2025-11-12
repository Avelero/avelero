"use client";

import { cn } from "@v1/ui/cn";
import type * as React from "react";

export interface CircularProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Progress percentage (0-100)
   */
  percentage: number;
  /**
   * Size of the circular progress in pixels
   * @default 48
   */
  size?: number;
  /**
   * Width of the progress stroke
   * @default 4
   */
  strokeWidth?: number;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Show percentage text in the center
   * @default false
   */
  showPercentage?: boolean;
}

export function CircularProgress({
  percentage,
  size = 48,
  strokeWidth = 4,
  className,
  showPercentage = false,
  ...props
}: CircularProgressProps) {
  // Ensure percentage is within 0-100 range
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  // Calculate circle parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate offset - when percentage is 0, show full circle (no progress)
  // when percentage is 100, show complete circle (full progress)
  const offset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clampedPercentage}% complete`}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-brand transition-all duration-500 ease-out"
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset: offset,
          }}
        />
      </svg>

      {/* Optional percentage text */}
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-primary">
            {Math.round(clampedPercentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

CircularProgress.displayName = "CircularProgress";
