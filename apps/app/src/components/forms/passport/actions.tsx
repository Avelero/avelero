"use client";

/**
 * Form Actions
 *
 * Control bar action buttons for product and variant forms.
 * - ProductFormActions: Cancel + Save for product forms
 * - VariantFormActions: Back + Save/Create for variant forms
 * - FormActionsWrapper: Conditionally renders correct actions based on context
 */

import {
  FirstPublishModal,
  shouldShowFirstPublishModal,
} from "@/components/modals/first-publish-modal";
import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { useNavigationBlocker } from "@/hooks/use-navigation-blocker";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
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
    formResetCallbackRef,
    productId,
    publishingStatus,
    hasDbUnpublishedChanges,
    setPublishingStatus,
    setHasDbUnpublishedChanges,
  } = usePassportFormContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Publishing mutation
  const publishProductMutation = useMutation(
    trpc.products.publish.product.mutationOptions(),
  );

  // First publish modal state
  const [showFirstPublishModal, setShowFirstPublishModal] =
    React.useState(false);

  // Actual publish logic
  const executePublish = React.useCallback(async () => {
    if (!productId) {
      toast.error("Cannot publish: product has not been saved yet");
      return;
    }

    try {
      const result = await publishProductMutation.mutateAsync({ productId });
      if (result.success) {
        toast.success("Product published successfully");

        // Update publishing status immediately in context so UI updates without page refresh
        setPublishingStatus("published");
        setHasDbUnpublishedChanges(false);

        // Invalidate queries to refresh data
        if (productHandle) {
          await queryClient.invalidateQueries({
            queryKey: trpc.products.get.queryKey({ handle: productHandle }),
          });
        }
        await queryClient.invalidateQueries({
          queryKey: trpc.products.list.queryKey(),
        });
      }
    } catch (err) {
      console.error("Publish failed:", err);
      toast.error("Failed to publish product");
    }
  }, [
    productId,
    productHandle,
    publishProductMutation,
    queryClient,
    trpc,
    setPublishingStatus,
    setHasDbUnpublishedChanges,
  ]);

  // Handle publish button click - show modal on first publish if preference not set
  const handlePublish = React.useCallback(() => {
    if (!productId) {
      toast.error("Cannot publish: product has not been saved yet");
      return;
    }

    // On first publish, show warning modal (unless user dismissed it before)
    const isFirstPublish = publishingStatus === "unpublished";
    if (isFirstPublish && shouldShowFirstPublishModal()) {
      setShowFirstPublishModal(true);
    } else {
      void executePublish();
    }
  }, [productId, publishingStatus, executePublish]);

  // First publish modal handlers
  const handleFirstPublishConfirm = React.useCallback(() => {
    setShowFirstPublishModal(false);
    void executePublish();
  }, [executePublish]);

  const handleFirstPublishCancel = React.useCallback(() => {
    setShowFirstPublishModal(false);
  }, []);

  // Determine publish button state
  const isPublished = publishingStatus === "published";
  const canPublish =
    productId &&
    (publishingStatus === "unpublished" || hasDbUnpublishedChanges);
  const publishButtonText = isPublished ? "Publish changes" : "Publish";

  // Callback to reset form and invalidate cache when discarding changes
  const handleDiscard = React.useCallback(async () => {
    // Reset form state first (clears local values)
    if (formResetCallbackRef.current) {
      formResetCallbackRef.current();
    }
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
  }, [productHandle, queryClient, trpc, formResetCallbackRef]);

  const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
    useNavigationBlocker({
      shouldBlock: hasUnsavedChanges,
      onDiscard: handleDiscard,
    });

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
  }, [
    pendingNavigationUrl,
    setPendingNavigationUrl,
    handleDiscard,
    router,
    confirmNavigation,
  ]);

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
        disabled={isSubmitting || publishProductMutation.isPending}
      >
        Cancel
      </Button>
      <Button
        variant="brand"
        type="submit"
        form="passport-form"
        disabled={isSubmitting || publishProductMutation.isPending}
      >
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
      {/* Publish dropdown - only shown when product exists */}
      {productId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label="More actions"
              disabled={isSubmitting || publishProductMutation.isPending}
            >
              <Icons.EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handlePublish}
              disabled={!canPublish || publishProductMutation.isPending}
            >
              <div className="flex items-center">
                <Icons.StatusPublished width={12} height={12} />
                <span className="px-2">
                  {publishProductMutation.isPending
                    ? "Publishing..."
                    : publishButtonText}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <UnsavedChangesModal
        open={effectivePendingUrl !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelNavigation();
        }}
        onDiscard={handleConfirmDiscard}
        onKeepEditing={handleCancelNavigation}
      />

      <FirstPublishModal
        open={showFirstPublishModal}
        onOpenChange={setShowFirstPublishModal}
        onConfirm={handleFirstPublishConfirm}
        onCancel={handleFirstPublishCancel}
        isPublishing={publishProductMutation.isPending}
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
  const {
    isSubmitting,
    hasUnsavedChanges,
    productHandle,
    variantUpid,
    formResetCallbackRef,
  } = usePassportFormContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const backUrl = productHandle
    ? `/passports/edit/${productHandle}`
    : "/passports";

  // Callback to invalidate cache and reset form when discarding changes
  const handleDiscard = React.useCallback(async () => {
    // Reset form state first
    if (formResetCallbackRef.current) {
      formResetCallbackRef.current();
    }
    // Invalidate the product query to ensure fresh variant data on next visit
    if (productHandle) {
      await queryClient.invalidateQueries({
        queryKey: trpc.products.get.queryKey({ handle: productHandle }),
      });
    }
    // Invalidate variant-specific queries if editing an existing variant
    if (productHandle && variantUpid && variantUpid !== "new") {
      await queryClient.invalidateQueries({
        queryKey: trpc.products.variants.getOverrides.queryKey({
          productHandle,
          variantUpid,
        }),
      });
    }
  }, [productHandle, variantUpid, queryClient, trpc, formResetCallbackRef]);

  const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
    useNavigationBlocker({
      shouldBlock: hasUnsavedChanges,
      onDiscard: handleDiscard,
    });

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
        {isSubmitting
          ? isCreateMode
            ? "Creating..."
            : "Saving..."
          : isCreateMode
            ? "Create"
            : "Save"}
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
