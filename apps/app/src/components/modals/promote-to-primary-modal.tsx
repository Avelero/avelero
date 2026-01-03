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

interface PromoteToPrimaryModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    integrationId: string;
    integrationName: string;
    onConfirm: () => void;
    isPromoting: boolean;
}

/**
 * Modal for confirming integration promotion to primary.
 *
 * Warns user about the consequences of restructuring products
 * and requires confirmation before promoting.
 */
export function PromoteToPrimaryModal({
    open,
    onOpenChange,
    integrationName,
    onConfirm,
    isPromoting,
}: PromoteToPrimaryModalProps) {
    function handleOpenChange(newOpen: boolean) {
        if (isPromoting) return;
        onOpenChange(newOpen);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-[480px] p-0 gap-0 border border-border">
                <DialogHeader className="px-6 py-4 border-b border-border">
                    <DialogTitle className="text-foreground">
                        Promote to Primary
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-4 space-y-3">
                    <DialogDescription className="text-secondary">
                        Are you sure you want to make <strong className="text-foreground">{integrationName}</strong> your primary integration?
                    </DialogDescription>

                    <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
                        <p className="type-small text-warning font-medium mb-2">This will restructure your products</p>
                        <ul className="space-y-1 text-secondary type-small list-disc list-inside">
                            <li>Products will be re-grouped based on {integrationName}'s structure</li>
                            <li>Variants may be moved between products</li>
                            <li>Attributes will be updated to match {integrationName}'s options</li>
                            <li>Product QR codes and DPPs will remain connected</li>
                        </ul>
                    </div>

                    <p className="type-small text-secondary">
                        This operation cannot be automatically undone. You can manually promote another integration later if needed.
                    </p>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-border bg-background">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isPromoting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isPromoting}
                    >
                        {isPromoting ? "Promoting..." : "Promote to Primary"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
