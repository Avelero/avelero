"use client";

/**
 * VariantFormActions
 *
 * Control bar action buttons for variant forms (create and edit).
 * - Back button: Shows unsaved changes modal if needed, navigates back to product edit page
 * - Save/Create button: Submits the variant form
 * - Delete menu: Three-dot menu with delete option (edit mode only)
 */

import { UnsavedChangesModal } from "@/components/modals/unsaved-changes-modal";
import { usePassportFormContext } from "@/contexts/passport-form-context";
import { useNavigationBlocker } from "@/hooks/use-navigation-blocker";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@v1/ui/dialog";
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

interface VariantFormActionsProps {
    mode?: "create" | "edit";
}

export function VariantFormActions({ mode = "edit" }: VariantFormActionsProps) {
    const router = useRouter();
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { isSubmitting, hasUnsavedChanges, productHandle, variantUpid } =
        usePassportFormContext();
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

    const backUrl = productHandle
        ? `/passports/edit/${productHandle}`
        : "/passports";

    const { pendingUrl, confirmNavigation, cancelNavigation, requestNavigation } =
        useNavigationBlocker({ shouldBlock: hasUnsavedChanges });

    const handleBack = () => {
        requestNavigation(backUrl);
    };

    // Delete variant mutation
    const deleteVariantMutation = useMutation(
        trpc.products.variants.delete.mutationOptions()
    );

    const handleDelete = async () => {
        if (!productHandle || !variantUpid) return;

        try {
            await deleteVariantMutation.mutateAsync({
                productHandle,
                variantUpid,
            });

            // Invalidate queries
            await queryClient.invalidateQueries({
                queryKey: trpc.products.get.queryKey({
                    handle: productHandle,
                    includeVariants: true,
                    includeAttributes: true,
                }),
            });

            toast.success("Variant deleted successfully");
            router.push(backUrl);
        } catch (error) {
            console.error("Failed to delete variant:", error);
            toast.error("Failed to delete variant");
        }
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

            {/* Three-dot menu with delete option (edit mode only) */}
            {!isCreateMode && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            type="button"
                            disabled={isSubmitting || deleteVariantMutation.isPending}
                        >
                            <Icons.EllipsisVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <Icons.Trash2 className="h-4 w-4 mr-2" />
                            Delete variant
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <Button
                variant="brand"
                type="submit"
                form="variant-form"
                disabled={isSubmitting || deleteVariantMutation.isPending}
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

            {/* Delete confirmation dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Delete variant</DialogTitle>
                        <DialogDescription className="text-secondary">
                            Are you sure you want to delete this variant? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setShowDeleteDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            type="button"
                            onClick={() => {
                                handleDelete();
                                setShowDeleteDialog(false);
                            }}
                            disabled={deleteVariantMutation.isPending}
                        >
                            {deleteVariantMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
