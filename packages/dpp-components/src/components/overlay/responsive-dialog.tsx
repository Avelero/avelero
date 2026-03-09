"use client";

/**
 * Responsive dialog primitive for the DPP experience.
 *
 * It behaves like a bottom drawer on smaller viewports and a centered modal
 * on desktop, while keeping the content area consistent across both layouts.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";

const ResponsiveDialog = DialogPrimitive.Root;
const ResponsiveDialogTrigger = DialogPrimitive.Trigger;
const ResponsiveDialogClose = DialogPrimitive.Close;

interface ResponsiveDialogPortalProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal> {}

type ResponsiveDialogContainer = ResponsiveDialogPortalProps["container"];

function ResponsiveDialogPortal({
  container,
  children,
  ...props
}: ResponsiveDialogPortalProps) {
  // Prefer a portal target inside the DPP root so token CSS variables stay available.
  const [resolvedContainer, setResolvedContainer] =
    React.useState<ResponsiveDialogContainer>(() => {
      if (container !== undefined) {
        return container;
      }

      if (typeof document === "undefined") {
        return null;
      }

      return document.querySelector<HTMLElement>(".dpp-root");
    });

  React.useEffect(() => {
    // Resolve the container after mount because the dialog only needs browser APIs client-side.
    if (container !== undefined) {
      setResolvedContainer(container);
      return;
    }

    setResolvedContainer(document.querySelector<HTMLElement>(".dpp-root"));
  }, [container]);

  return (
    <DialogPrimitive.Portal
      container={resolvedContainer ?? undefined}
      {...props}
    >
      {children}
    </DialogPrimitive.Portal>
  );
}

const ResponsiveDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function ResponsiveDialogOverlay({ className, ...props }, ref) {
  // Render the dimmed backdrop behind the responsive drawer or modal.
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "dpp-native-dialog__overlay fixed inset-0 z-[90]",
        className,
      )}
      {...props}
    />
  );
});

interface ResponsiveDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  bodyClassName?: string;
  hideClose?: boolean;
}

const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ResponsiveDialogContentProps
>(function ResponsiveDialogContent(
  { bodyClassName, children, className, hideClose = false, style, ...props },
  ref,
) {
  // Render the responsive shell and the padded content region shared by DPP overlays.
  return (
    <ResponsiveDialogPortal>
      <ResponsiveDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "dpp-native-dialog__content fixed z-[91] flex flex-col overflow-hidden border border-black/5 outline-none",
          "shadow-[0_-18px_60px_rgba(15,23,42,0.18)] md:shadow-[0_28px_90px_rgba(15,23,42,0.18)]",
          className,
        )}
        style={{
          backgroundColor: "var(--card, #FFFFFF)",
          color: "var(--foreground, #1E2040)",
          ...style,
        }}
        {...props}
      >
        {!hideClose && (
          <ResponsiveDialogClose
            className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 hover:bg-[var(--muted-dark,#E0E0E0)]"
            style={{ color: "var(--muted-dark-foreground, #808080)" }}
          >
            <Icons.X aria-hidden className="h-4 w-4 shrink-0" />
            <span className="sr-only">Close</span>
          </ResponsiveDialogClose>
        )}

        <div
          className={cn(
            "scrollbar-none flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-6 pt-8",
            bodyClassName,
          )}
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </ResponsiveDialogPortal>
  );
});

function ResponsiveDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Group title and descriptive copy with the default drawer spacing.
  return (
    <div
      className={cn("flex flex-col gap-3 pr-14 text-left", className)}
      {...props}
    />
  );
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Align footer actions consistently across drawer and modal layouts.
  return (
    <div
      className={cn(
        "mt-auto flex flex-col gap-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function ResponsiveDialogTitle({ className, ...props }, ref) {
  // Render the accessible heading for the drawer or modal content.
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-[2rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-[2.25rem]",
        className,
      )}
      {...props}
    />
  );
});

const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function ResponsiveDialogDescription({ className, style, ...props }, ref) {
  // Render supportive body copy beneath the dialog title.
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-base leading-8", className)}
      style={{ color: "var(--muted-light-foreground, #62637A)", ...style }}
      {...props}
    />
  );
});

ResponsiveDialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
ResponsiveDialogContent.displayName = DialogPrimitive.Content.displayName;
ResponsiveDialogTitle.displayName = DialogPrimitive.Title.displayName;
ResponsiveDialogDescription.displayName =
  DialogPrimitive.Description.displayName;

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogPortal,
  ResponsiveDialogOverlay,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
