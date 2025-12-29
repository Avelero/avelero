"use client";

/**
 * Form Actions
 *
 * Control bar action buttons for product and variant forms.
 * - ProductFormActions: Cancel + Save for product forms
 * - VariantFormActions: Back + Save/Create for variant forms
 * - FormActionsWrapper: Conditionally renders correct actions based on context
 */

import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { useNavigationBlocker } from "@/hooks/use-navigation-blocker";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";
import * as React from "react";

// ============================================================================
// Product Form Actions
// ============================================================================

export function ProductFormActions() {
    const {
        isSubmitting,
        hasUnsavedChanges,
        productHandle,
        pendingNavigationUrl,
        setPendingNavigationUrl,
    } = usePassportFormContext();
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const router = useRouter();

    // Callback to invalidate cache when discarding changes
    const handleDiscard = React.useCallback(async () => {
        // Invalidate the specific product query to ensure fresh data on next visit
        if (productHandle) {
            await queryClient.invalidateQueries({
                queryKey: trpc.products.get.queryKey({ handle: productHandle }),
            });
        }
        // Also invalidate the product list in case any preview data changed
        await queryClient.invalidateQueries({
            queryKey: trpc.products.list.queryKey(),
        });
    }, [productHandle, queryClient, trpc]);

    const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
        useNavigationBlocker({ shouldBlock: hasUnsavedChanges, onDiscard: handleDiscard });

    // Combine both sources of pending navigation
    const effectivePendingUrl = pendingNavigationUrl ?? pendingUrl;

    const handleCancel = () => {
        requestNavigation("/passports");
    };

    // Handle confirm from modal - supports both hook and context pending URLs
    const handleConfirmDiscard = React.useCallback(async () => {
        if (pendingNavigationUrl) {
            // Clear context pending URL and navigate
            const url = pendingNavigationUrl;
            setPendingNavigationUrl(null);
            await handleDiscard();
            router.push(url);
        } else {
            // Use hook's confirm navigation
            await confirmNavigation();
        }
    }, [pendingNavigationUrl, setPendingNavigationUrl, handleDiscard, router, confirmNavigation]);

    // Handle cancel from modal - clears both sources
    const handleCancelNavigation = React.useCallback(() => {
        setPendingNavigationUrl(null);
        cancelNavigation();
    }, [setPendingNavigationUrl, cancelNavigation]);

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
                open={effectivePendingUrl !== null}
                onOpenChange={(open) => {
                    if (!open) handleCancelNavigation();
                }}
                onDiscard={handleConfirmDiscard}
                onKeepEditing={handleCancelNavigation}
            />
        </>
    );
}

// ============================================================================
// Variant Form Actions
// ============================================================================

interface VariantFormActionsProps {
    mode?: "create" | "edit";
}

export function VariantFormActions({ mode = "edit" }: VariantFormActionsProps) {
    const { isSubmitting, hasUnsavedChanges, productHandle, variantUpid } =
        usePassportFormContext();
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const backUrl = productHandle
        ? `/passports/edit/${productHandle}`
        : "/passports";

    // Callback to invalidate cache when discarding changes
    const handleDiscard = React.useCallback(async () => {
        // Invalidate the product query to ensure fresh variant data on next visit
        if (productHandle) {
            await queryClient.invalidateQueries({
                queryKey: trpc.products.get.queryKey({ handle: productHandle }),
            });
        }
        // Invalidate variant-specific queries if editing an existing variant
        if (productHandle && variantUpid && variantUpid !== "new") {
            await queryClient.invalidateQueries({
                queryKey: trpc.products.variants.getOverrides.queryKey({ productHandle, variantUpid }),
            });
        }
    }, [productHandle, variantUpid, queryClient, trpc]);

    const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
        useNavigationBlocker({ shouldBlock: hasUnsavedChanges, onDiscard: handleDiscard });

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

// ============================================================================
// Form Actions Wrapper
// ============================================================================

export function FormActionsWrapper() {
    const { formType, variantUpid } = usePassportFormContext();

    if (formType === "variant") {
        // Determine if create mode based on variantUpid
        const mode = variantUpid === "new" ? "create" : "edit";
        return <VariantFormActions mode={mode} />;
    }

    return <ProductFormActions />;
}
