"use client";

import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";

/**
 * Generic error fallback used by route-level ErrorBoundary wrappers.
 */
export function ErrorFallback() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 py-8">
      <h2 className="text-base">Something went wrong</h2>
      <Button onClick={() => router.refresh()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
