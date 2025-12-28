"use client";

/**
 * ProductFormActions
 *
 * Control bar action buttons for product create and edit forms.
 * - Cancel button: Shows unsaved changes modal if needed, navigates to /passports
 * - Save button: Submits the product form
 */

import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { useNavigationBlocker } from "@/hooks/use-navigation-blocker";
import { Button } from "@v1/ui/button";
import * as React from "react";

export function ProductFormActions() {
  const { isSubmitting, hasUnsavedChanges } = usePassportFormContext();

  const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
    useNavigationBlocker({ shouldBlock: hasUnsavedChanges });

  const handleCancel = () => {
    requestNavigation("/passports");
  };

  return (
    <>
      <Button
        variant="outline"
        type="button"
        onClick={handleCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        variant="brand"
        type="submit"
        form="passport-form"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Save"}
      </Button>

      <UnsavedChangesModal
        open={pendingUrl !== null}
        onOpenChange={(open) => {
          if (!open) cancelNavigation();
        }}
        onDiscard={confirmNavigation}
        onKeepEditing={cancelNavigation}
      />
    </>
  );
}
