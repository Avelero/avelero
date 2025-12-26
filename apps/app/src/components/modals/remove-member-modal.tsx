"use client";

import { Button } from "@v1/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@v1/ui/dialog";

interface RemoveMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memberEmail: string;
    isRemoving: boolean;
    onConfirm: () => void;
}

/**
 * Modal for confirming member removal from a brand.
 *
 * Warns user about the consequences and requires confirmation
 * before removing the member.
 */
export function RemoveMemberModal({
    open,
    onOpenChange,
    memberEmail,
    isRemoving,
    onConfirm,
}: RemoveMemberModalProps) {
    function handleOpenChange(newOpen: boolean) {
        if (isRemoving) return;
        onOpenChange(newOpen);
    }

    function handleConfirm() {
        onConfirm();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[480px] p-0 gap-0 border border-border">
                <DialogHeader className="px-6 py-4 border-b border-border">
                    <DialogTitle className="text-foreground">Remove member</DialogTitle>
                </DialogHeader>

                <div className="px-6 py-4">
                    <DialogDescription className="text-secondary">
                        Are you sure you want to remove{" "}
                        <span className="font-medium text-foreground">{memberEmail}</span>{" "}
                        from this brand? They will lose access immediately and will need to
                        be re-invited to regain access.
                    </DialogDescription>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-border bg-background">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isRemoving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isRemoving}
                    >
                        {isRemoving ? "Removing..." : "Remove"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
