"use client";

import { Button } from "@v1/ui/button";
import { useEffect } from "react";

const SUPPORT_EMAIL = "support@avelero.com";

/**
 * Sidebar segment error boundary.
 */
export default function SidebarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Placeholder effect for future client error reporting integration.
  useEffect(() => {}, [error]);

  return (
    <div className="h-[calc(100vh-200px)] w-full flex items-center justify-center">
      <div className="max-w-md w-full text-center px-4">
        <h2 className="font-medium mb-4">Something went wrong</h2>
        <p className="text-sm text-secondary mb-6">
          We are looking into it. If this keeps happening, contact support.
        </p>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-sm underline underline-offset-4 text-primary"
        >
          {SUPPORT_EMAIL}
        </a>

        {error.digest ? (
          <p className="text-xs text-secondary mt-4">Error ID: {error.digest}</p>
        ) : null}

        <Button onClick={() => reset()} variant="outline" className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
