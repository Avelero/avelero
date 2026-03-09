"use client";

/**
 * Unified modal primitive and slot-aware building blocks for DPP components.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";

const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;

export type ModalStyles = Record<string, React.CSSProperties>;
export type ModalSelectionGetter = (slotId: string) => Record<string, string>;

function getModalSlotStyle(
  styles: ModalStyles | undefined,
  slotId: string,
  style: React.CSSProperties | undefined,
) {
  // Merge the modal slot styles with any per-instance override for the same element.
  return {
    ...(styles?.[slotId] ?? {}),
    ...style,
  };
}

export function getModalSelectionProps(
  select: ModalSelectionGetter | undefined,
  slotId: string,
) {
  // Resolve editor selection attributes only when a section passes a scoped getter.
  return select?.(slotId) ?? {};
}

interface ModalPortalProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal> {}

type ModalContainer = ModalPortalProps["container"];

function ModalPortal({ container, children, ...props }: ModalPortalProps) {
  // Prefer a portal target inside the DPP root so token CSS variables stay available.
  const [resolvedContainer, setResolvedContainer] =
    React.useState<ModalContainer>(() => {
      if (container !== undefined) {
        return container;
      }

      if (typeof document === "undefined") {
        return null;
      }

      return document.querySelector<HTMLElement>(".dpp-root");
    });

  React.useEffect(() => {
    // Resolve the container after mount because the modal only needs browser APIs client-side.
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

const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function ModalOverlay({ className, ...props }, ref) {
  // Render the dimmed backdrop behind the modal shell.
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

interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  bodyClassName?: string;
  hideClose?: boolean;
  styles?: ModalStyles;
}

const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(function ModalContent(
  {
    bodyClassName,
    children,
    className,
    hideClose = false,
    style,
    styles,
    ...props
  },
  ref,
) {
  // Render the shared modal shell and the padded content region used by the DPP overlays.
  const contentStyle = getModalSlotStyle(styles, "modal.container", style);

  return (
    <ModalPortal>
      <ModalOverlay />
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
          ...contentStyle,
        }}
        {...props}
      >
        {!hideClose && (
          <ModalClose
            className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 hover:bg-[var(--muted-dark,#E0E0E0)]"
            style={{ color: "var(--muted-dark-foreground, #808080)" }}
          >
            <Icons.X aria-hidden className="h-4 w-4 shrink-0" />
            <span className="sr-only">Close</span>
          </ModalClose>
        )}

        <div
          className={cn(
            "scrollbar-none flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 pt-8",
            bodyClassName,
          )}
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </ModalPortal>
  );
});

function ModalHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Group the modal title and supporting copy with the default shell spacing.
  return (
    <div
      className={cn("flex flex-col gap-3 pr-14 text-left", className)}
      {...props}
    />
  );
}

function ModalFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Align footer actions consistently across modal layouts.
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

interface ModalTitleProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
  styles?: ModalStyles;
}

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  ModalTitleProps
>(function ModalTitle({ className, style, styles, ...props }, ref) {
  // Render the accessible heading with the shared modal title defaults and slot overrides.
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-[2rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-[2.25rem]",
        className,
      )}
      style={getModalSlotStyle(styles, "modal.title", style)}
      {...props}
    />
  );
});

interface ModalDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> {
  styles?: ModalStyles;
}

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  ModalDescriptionProps
>(function ModalDescription({ className, style, styles, ...props }, ref) {
  // Render the primary descriptive copy for the modal body.
  const descriptionStyle = getModalSlotStyle(
    styles,
    "modal.description",
    style,
  );

  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-base leading-8 whitespace-pre-line", className)}
      style={{
        color: "var(--muted-light-foreground, #62637A)",
        ...descriptionStyle,
      }}
      {...props}
    />
  );
});

function ModalSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Group related modal content into a predictable vertical rhythm.
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

interface ModalSubtitleProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  styles?: ModalStyles;
}

function ModalSubtitle({
  className,
  style,
  styles,
  ...props
}: ModalSubtitleProps) {
  // Render the medium-emphasis subtitle slot above the primary modal title.
  return (
    <p
      className={cn("text-base leading-7", className)}
      style={getModalSlotStyle(styles, "modal.subtitle", style)}
      {...props}
    />
  );
}

interface ModalLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  styles?: ModalStyles;
}

function ModalLabel({ className, style, styles, ...props }: ModalLabelProps) {
  // Render the compact label slot used for modal fact rows.
  return (
    <div
      className={cn("text-sm font-medium leading-6", className)}
      style={getModalSlotStyle(styles, "modal.label", style)}
      {...props}
    />
  );
}

interface ModalValueProps extends React.HTMLAttributes<HTMLDivElement> {
  styles?: ModalStyles;
}

function ModalValue({ className, style, styles, ...props }: ModalValueProps) {
  // Render the value slot paired with modal labels and descriptive facts.
  return (
    <div
      className={cn("whitespace-pre-line text-sm leading-6", className)}
      style={getModalSlotStyle(styles, "modal.value", style)}
      {...props}
    />
  );
}

interface ModalFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  labelProps?: React.HTMLAttributes<HTMLDivElement>;
  styles?: ModalStyles;
  value: React.ReactNode;
  valueProps?: React.HTMLAttributes<HTMLDivElement>;
}

function ModalField({
  className,
  label,
  labelProps,
  styles,
  value,
  valueProps,
  ...props
}: ModalFieldProps) {
  // Render a reusable label and value row for quick overview layouts.
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4",
        className,
      )}
      {...props}
    >
      <ModalLabel styles={styles} {...labelProps}>
        {label}
      </ModalLabel>
      <ModalValue styles={styles} {...valueProps}>
        {value}
      </ModalValue>
    </div>
  );
}

ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;
ModalContent.displayName = DialogPrimitive.Content.displayName;
ModalTitle.displayName = DialogPrimitive.Title.displayName;
ModalDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalPortal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
  ModalSection,
  ModalSubtitle,
  ModalLabel,
  ModalValue,
  ModalField,
};
