"use client";

/**
 * Reusable building blocks for stylable DPP modal content.
 *
 * These primitives map section-local modal style slots onto the shared
 * responsive dialog shell without introducing a second styling system.
 */

import { cn } from "@v1/ui/cn";
import * as React from "react";
import {
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogTitle,
} from "../responsive-dialog";

export type DppModalStyles = Record<string, React.CSSProperties>;
export type DppModalSelectionGetter = (
  slotId: string,
) => Record<string, string>;

function getModalSlotStyle(
  styles: DppModalStyles,
  slotId: string,
  style: React.CSSProperties | undefined,
) {
  // Merge section-provided slot styles with the instance override for a modal element.
  return {
    ...(styles[slotId] ?? {}),
    ...style,
  };
}

export function getModalSelectionProps(
  select: DppModalSelectionGetter | undefined,
  slotId: string,
) {
  // Resolve editor selection attributes only when a section passes a scoped getter.
  return select?.(slotId) ?? {};
}

interface DppModalContentProps
  extends React.ComponentPropsWithoutRef<typeof ResponsiveDialogContent> {
  styles: DppModalStyles;
}

export function DppModalContent({
  bodyClassName,
  styles,
  style,
  ...props
}: DppModalContentProps) {
  // Render the shared modal shell with section-configurable container styling.
  return (
    <ResponsiveDialogContent
      bodyClassName={cn("gap-4", bodyClassName)}
      style={getModalSlotStyle(styles, "modal.container", style)}
      {...props}
    />
  );
}

export function DppModalSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // Group related modal content into a predictable vertical rhythm.
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

interface DppModalTitleProps
  extends React.ComponentPropsWithoutRef<typeof ResponsiveDialogTitle> {
  styles: DppModalStyles;
}

export const DppModalTitle = React.forwardRef<
  React.ElementRef<typeof ResponsiveDialogTitle>,
  DppModalTitleProps
>(function DppModalTitle({ className, style, styles, ...props }, ref) {
  // Render the large modal heading with the section's title slot overrides.
  return (
    <ResponsiveDialogTitle
      ref={ref}
      className={cn(className)}
      style={getModalSlotStyle(styles, "modal.title", style)}
      {...props}
    />
  );
});

interface DppModalSubtitleProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  styles: DppModalStyles;
}

export function DppModalSubtitle({
  className,
  style,
  styles,
  ...props
}: DppModalSubtitleProps) {
  // Render the medium-emphasis subtitle slot used above the primary modal title.
  return (
    <p
      className={cn("text-base leading-7", className)}
      style={getModalSlotStyle(styles, "modal.subtitle", style)}
      {...props}
    />
  );
}

interface DppModalDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof ResponsiveDialogDescription> {
  styles: DppModalStyles;
}

export const DppModalDescription = React.forwardRef<
  React.ElementRef<typeof ResponsiveDialogDescription>,
  DppModalDescriptionProps
>(function DppModalDescription({ className, style, styles, ...props }, ref) {
  // Render the main paragraph slot for long-form modal copy.
  return (
    <ResponsiveDialogDescription
      ref={ref}
      className={cn("whitespace-pre-line", className)}
      style={getModalSlotStyle(styles, "modal.description", style)}
      {...props}
    />
  );
});

interface DppModalLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  styles: DppModalStyles;
}

export function DppModalLabel({
  className,
  style,
  styles,
  ...props
}: DppModalLabelProps) {
  // Render the compact label slot used for fact names inside form-like modal layouts.
  return (
    <div
      className={cn("text-sm font-medium leading-6", className)}
      style={getModalSlotStyle(styles, "modal.label", style)}
      {...props}
    />
  );
}

interface DppModalValueProps extends React.HTMLAttributes<HTMLDivElement> {
  styles: DppModalStyles;
}

export function DppModalValue({
  className,
  style,
  styles,
  ...props
}: DppModalValueProps) {
  // Render the value slot paired with compact modal labels.
  return (
    <div
      className={cn("text-sm leading-6 whitespace-pre-line", className)}
      style={getModalSlotStyle(styles, "modal.value", style)}
      {...props}
    />
  );
}

interface DppModalFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  labelProps?: React.HTMLAttributes<HTMLDivElement>;
  styles: DppModalStyles;
  value: React.ReactNode;
  valueProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function DppModalField({
  className,
  label,
  labelProps,
  styles,
  value,
  valueProps,
  ...props
}: DppModalFieldProps) {
  // Render a reusable label/value row for operator and certification quick overviews.
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4",
        className,
      )}
      {...props}
    >
      <DppModalLabel styles={styles} {...labelProps}>
        {label}
      </DppModalLabel>
      <DppModalValue styles={styles} {...valueProps}>
        {value}
      </DppModalValue>
    </div>
  );
}

DppModalTitle.displayName = "DppModalTitle";
DppModalDescription.displayName = "DppModalDescription";
