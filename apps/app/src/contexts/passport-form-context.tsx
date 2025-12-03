"use client";

import * as React from "react";

interface PassportFormContextType {
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

const PassportFormContext = React.createContext<PassportFormContextType | null>(
  null,
);

/**
 * Provider component that wraps the passport form and actions
 * to share submission state between them.
 */
export function PassportFormProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const value = React.useMemo(
    () => ({
      isSubmitting,
      setIsSubmitting,
      hasUnsavedChanges,
      setHasUnsavedChanges,
    }),
    [isSubmitting, hasUnsavedChanges],
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
