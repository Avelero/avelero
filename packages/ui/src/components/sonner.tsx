"use client";

import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { Icons } from "./icons";

// Toaster provider - place in root layout
export function Toaster() {
  return <Sonner position="bottom-right" className="toaster group" />;
}

// Toast component with success/error styling
interface ToastProps {
  id: string | number;
  message: string;
  state: "success" | "error";
}

function Toast({ id, message, state }: ToastProps) {
  const styles = {
    success: {
      container: "border-border bg-background text-foreground",
    },
    error: {
      container: "border-destructive bg-background text-foreground",
    },
  }[state];

  return (
    <div
      className={`flex w-[360px] items-center justify-between gap-4 border p-4 shadow-sm ${styles.container}`}
    >
      <p className="flex-1 text-[13px] font-normal leading-[21px] tracking-wide line-clamp-2">
        {message}
      </p>
      <button
        type="button"
        onClick={() => sonnerToast.dismiss(id)}
        className="p-1 hover:bg-accent"
        aria-label="Dismiss"
      >
        <Icons.X className="h-4 w-4 text-tertiary" />
      </button>
    </div>
  );
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
};

// Re-export original toast for advanced usage
export { sonnerToast };
