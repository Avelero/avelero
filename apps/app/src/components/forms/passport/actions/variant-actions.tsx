"use client";

/**
 * VariantFormActions
 *
 * Control bar action buttons for variant forms (create and edit).
 * - Back button: Shows unsaved changes modal if needed, navigates back to product edit page
 * - Save/Create button: Submits the variant form
 * 
 * Note: The delete option is now in the variants-overview sidebar, not here.
 */

import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { useNavigationBlocker } from "@/hooks/use-navigation-blocker";
import { Button } from "@v1/ui/button";
import * as React from "react";

interface VariantFormActionsProps {
    mode?: "create" | "edit";
}

export function VariantFormActions({ mode = "edit" }: VariantFormActionsProps) {
    const { isSubmitting, hasUnsavedChanges, productHandle } =
        usePassportFormContext();

    const backUrl = productHandle
        ? `/passports/edit/${productHandle}`
        : "/passports";

    const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
        useNavigationBlocker({ shouldBlock: hasUnsavedChanges });

    const handleBack = () => {
        requestNavigation(backUrl);
    };

    const isCreateMode = mode === "create";

    return (
        <>
            <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
            >
                Back
            </Button>

            <Button
                variant="brand"
                type="submit"
                form="variant-form"
                disabled={isSubmitting}
            >
                {isSubmitting ? (isCreateMode ? "Creating..." : "Saving...") : (isCreateMode ? "Create" : "Save")}
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
