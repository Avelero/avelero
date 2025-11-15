"use client";

import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { Icons } from "./icons";

// Toaster provider - place in root layout
export function Toaster() {
  return <Sonner position="bottom-right" className="toaster group" />;
}

// Toast component with success/error/loading styling
interface ToastProps {
  id: string | number;
  message: string;
  state: "success" | "error" | "loading";
}

function Toast({ id, message, state }: ToastProps) {
  const styles = {
    success: {
      container: "border-border bg-background text-foreground",
    },
    error: {
      container: "border-destructive bg-background text-foreground",
    },
    loading: {
      container: "border-border bg-background text-foreground",
    },
  }[state];

  return (
    <div
      className={`flex w-[360px] items-center justify-between gap-4 border p-4 shadow-sm ${styles.container}`}
    >
      <div className="flex items-center gap-3 flex-1">
        {state === "loading" && (
          <Icons.Loader className="h-4 w-4 text-tertiary animate-spin" />
        )}
        <p className="flex-1 text-[13px] font-normal leading-[21px] tracking-wide line-clamp-2">
          {message}
        </p>
      </div>
      {state !== "loading" && (
        <button
          type="button"
          onClick={() => sonnerToast.dismiss(id)}
          className="p-1 hover:bg-accent"
          aria-label="Dismiss"
        >
          <Icons.X className="h-4 w-4 text-tertiary" />
        </button>
      )}
    </div>
  );
}

/**
 * Shows a loading toast with a minimum delay.
 * Only displays if the promise takes longer than the specified delay.
 *
 * @param message - Loading message to display
 * @param promise - Promise to wait for
 * @param options - Configuration options
 * @returns Promise that resolves with the original promise result
 */
async function loadingWithDelay<T>(
  message: string,
  promise: Promise<T>,
  options: {
    delay?: number;
    successMessage?: string;
    errorMessage?: string;
  } = {},
): Promise<T> {
  const { delay = 200, successMessage, errorMessage } = options;

  let toastId: string | number | undefined;
  let hasShownToast = false;

  // Show loading toast only if promise takes longer than delay
  const timeoutId = setTimeout(() => {
    toastId = sonnerToast.custom((id) => (
      <Toast id={id} message={message} state="loading" />
    ));
    hasShownToast = true;
  }, delay);

  try {
    const result = await promise;
    clearTimeout(timeoutId);

    // Dismiss loading toast if it was shown
    if (hasShownToast && toastId !== undefined) {
      sonnerToast.dismiss(toastId);
    }

    // Show success message if provided
    if (successMessage) {
      toast.success(successMessage);
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    // Dismiss loading toast if it was shown
    if (hasShownToast && toastId !== undefined) {
      sonnerToast.dismiss(toastId);
    }

    // Show error message if provided
    if (errorMessage) {
      toast.error(errorMessage);
    }

    throw error;
  }
}

// Export simple toast functions
export const toast = {
  success: (message: string) =>
    sonnerToast.custom((id) => (
      <Toast id={id} message={message} state="success" />
    )),
  error: (message: string) =>
    sonnerToast.custom((id) => (
      <Toast id={id} message={message} state="error" />
    )),
  loading: loadingWithDelay,
};

// Re-export original toast for advanced usage
export { sonnerToast };
