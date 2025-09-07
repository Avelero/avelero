"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    // Intentionally left blank: Sentry removed
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2>Something went wrong!</h2>
          <p>An error occurred. Please try again later.</p>
        </div>
      </body>
    </html>
  );
}
