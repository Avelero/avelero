"use client";

/**
 * PassportFormContext
 *
 * Unified context for passport form state management.
 * Supports product create, product edit, and variant edit forms.
 *
 * Features:
 * - Tracks form type and identifiers
 * - Manages submission state
 * - Tracks unsaved changes
 * - Handles navigation blocking with pending URL state
 */

import * as React from "react";

type FormType = "create" | "edit" | "variant";

interface PassportFormContextType {
  // Form identification
  formType: FormType;
  setFormType: (type: FormType) => void;
  productHandle: string | null;
  setProductHandle: (handle: string | null) => void;
  variantUpid: string | null;
  setVariantUpid: (upid: string | null) => void;

  // Submission state
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;

  // Unsaved changes tracking
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;

  // Navigation control
  pendingNavigationUrl: string | null;
  setPendingNavigationUrl: (url: string | null) => void;
}

const PassportFormContext = React.createContext<PassportFormContextType | null>(
  null,
);

/**
 * Provider component that wraps passport forms (product create, edit, and variant edit)
 * to share state between form components and action buttons in the control bar.
 */
export function PassportFormProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Form identification
  const [formType, setFormType] = React.useState<FormType>("create");
  const [productHandle, setProductHandle] = React.useState<string | null>(null);
  const [variantUpid, setVariantUpid] = React.useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Navigation control
  const [pendingNavigationUrl, setPendingNavigationUrl] = React.useState<
    string | null
  >(null);

  const value = React.useMemo(
    () => ({
      formType,
      setFormType,
      productHandle,
      setProductHandle,
      variantUpid,
      setVariantUpid,
      isSubmitting,
      setIsSubmitting,
      hasUnsavedChanges,
      setHasUnsavedChanges,
      pendingNavigationUrl,
      setPendingNavigationUrl,
    }),
    [
      formType,
      productHandle,
      variantUpid,
      isSubmitting,
      hasUnsavedChanges,
      pendingNavigationUrl,
    ],
  );

  return (
    <PassportFormContext.Provider value={value}>
      {children}
    </PassportFormContext.Provider>
  );
}

/**
 * Hook to access the passport form context.
 * Must be used within a PassportFormProvider.
 */
export function usePassportFormContext() {
  const context = React.useContext(PassportFormContext);
  if (!context) {
    throw new Error(
      "usePassportFormContext must be used within PassportFormProvider",
    );
  }
  return context;
}

/**
 * Hook to register a form with the context.
 * Call this in your form component to set up the form type and identifiers.
 */
export function useRegisterForm(options: {
  type: FormType;
  productHandle?: string;
  variantUpid?: string;
}) {
  const {
    setFormType,
    setProductHandle,
    setVariantUpid,
    setHasUnsavedChanges,
  } = usePassportFormContext();

  React.useEffect(() => {
    setFormType(options.type);
    setProductHandle(options.productHandle ?? null);
    setVariantUpid(options.variantUpid ?? null);

    // Reset unsaved changes when form mounts
    setHasUnsavedChanges(false);

    // Cleanup on unmount
    return () => {
      setHasUnsavedChanges(false);
    };
  }, [
    options.type,
    options.productHandle,
    options.variantUpid,
    setFormType,
    setProductHandle,
    setVariantUpid,
    setHasUnsavedChanges,
  ]);
}
