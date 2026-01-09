"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import { createClient } from "@v1/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

type ImportStep = "method" | "upload" | "options" | "confirmation";
type ImportMethod = "upload" | "integration" | null;
type ImportMode = "CREATE" | "CREATE_AND_ENRICH";

interface ImportProductsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const TEMPLATE_DOWNLOAD_URL = "/api/templates/avelero-bulk-import-template.xlsx";

// ============================================================================
// Component
// ============================================================================

export function ImportProductsModal({
    open,
    onOpenChange,
    onSuccess,
}: ImportProductsModalProps) {
    const router = useRouter();
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [step, setStep] = useState<ImportStep>("method");
    const [method, setMethod] = useState<ImportMethod>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
    const [mode, setMode] = useState<ImportMode>("CREATE");
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Reset state when modal closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Delay reset to avoid flash during animation
            setTimeout(() => {
                setStep("method");
                setMethod(null);
                setFile(null);
                setUploadedFileId(null);
                setMode("CREATE");
                setIsUploading(false);
                setIsDragging(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }, 350);
        }
        onOpenChange(newOpen);
    };

    // Start import mutation
    const startImportMutation = useMutation(
        trpc.bulk.import.start.mutationOptions({
            onSuccess: (result) => {
                toast.success(`Import started - Job ${result.jobId.slice(0, 8)}... is processing`);
                void queryClient.invalidateQueries({
                    queryKey: [["bulk", "import", "getRecentImports"]],
                });
                onSuccess?.();
                handleOpenChange(false);
            },
            onError: (error) => {
                toast.error(error.message || "Failed to start import");
            },
        })
    );

    // Validate and upload file
    const validateAndUploadFile = async (selectedFile: File) => {
        // Validate file type
        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ];
        const allowedExtensions = [".xlsx", ".xls"];
        const hasValidExtension = allowedExtensions.some((ext) =>
            selectedFile.name.toLowerCase().endsWith(ext)
        );

        if (!allowedTypes.includes(selectedFile.type) && !hasValidExtension) {
            toast.error("Invalid file type - please upload .xlsx or .xls");
            return;
        }

        // Validate file size (50MB limit)
        const maxSize = 50 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            toast.error("File too large - please upload a file smaller than 50MB");
            return;
        }

        setIsUploading(true);
        try {
            // Generate a unique path for the file
            const timestamp = Date.now();
            const fileName = `${timestamp}-${selectedFile.name}`;
            const path = `imports/${fileName}`;

            const { data, error } = await supabase.storage
                .from("bulk-imports")
                .upload(path, selectedFile, {
                    contentType: selectedFile.type,
                    upsert: false,
                });

            if (error) {
                throw new Error(`Upload failed: ${error.message}`);
            }

            setFile(selectedFile);
            setUploadedFileId(data.path);
            setStep("options");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload file");
        } finally {
            setIsUploading(false);
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const selectedFile = files[0];
            if (selectedFile) {
                void validateAndUploadFile(selectedFile);
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const selectedFile = files[0];
            if (selectedFile) {
                void validateAndUploadFile(selectedFile);
            }
        }
    };

    const handleClick = () => {
        if (!isUploading) {
            fileInputRef.current?.click();
        }
    };

    // Navigation handlers
    const handleMethodSelect = (selectedMethod: ImportMethod) => {
        if (selectedMethod === "integration") {
            router.push("/settings/integrations");
            handleOpenChange(false);
        } else {
            setMethod(selectedMethod);
            setStep("upload");
        }
    };

    const handleBack = () => {
        if (step === "upload") {
            setStep("method");
            setMethod(null);
            setFile(null);
            setUploadedFileId(null);
        } else if (step === "options") {
            setStep("upload");
            setFile(null);
            setUploadedFileId(null);
        } else if (step === "confirmation") {
            setStep("options");
        }
    };

    const handleProceedToConfirmation = () => {
        setStep("confirmation");
    };

    const handleStartImport = () => {
        if (!uploadedFileId || !file) return;

        startImportMutation.mutate({
            fileId: uploadedFileId,
            filename: file.name,
            mode,
        });
    };

    // Summary text for confirmation screen
    const getModeDescription = () => {
        if (mode === "CREATE") {
            return "Products with matching handles will be skipped. Only new products will be created.";
        }
        return "New products will be created. Existing products with matching handles will be enriched with data from the Excel file.";
    };

    const isImporting = startImportMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="rounded-none sm:rounded-none p-0 gap-0 border border-border focus:outline-none focus-visible:outline-none max-w-lg">
                {/* Step 1: Method Selection */}
                {step === "method" && (
                    <>
                        <DialogHeader className="p-6 pb-4">
                            <DialogTitle className="text-foreground">
                                Import products
                            </DialogTitle>
                            <DialogDescription className="text-secondary">
                                How do you want to import your products?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-6 pb-6 space-y-3">
                            {/* Upload Excel Option */}
                            <button
                                type="button"
                                onClick={() => handleMethodSelect("upload")}
                                className={cn(
                                    "w-full p-4 border text-left transition-colors hover:border-foreground/50",
                                    method === "upload"
                                        ? "border-foreground bg-muted/50"
                                        : "border-border"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-foreground flex items-center justify-center shrink-0">
                                        {method === "upload" && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium text-foreground">
                                            Upload an Avelero-formatted Excel file
                                        </div>
                                        <div className="text-sm text-secondary mt-0.5">
                                            Import a file that's already formatted to fit Avelero's
                                            template.{" "}
                                            <a
                                                href={TEMPLATE_DOWNLOAD_URL}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-brand hover:underline"
                                            >
                                                Download sample Excel
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* Integration Option */}
                            <button
                                type="button"
                                onClick={() => handleMethodSelect("integration")}
                                className="w-full p-4 border text-left transition-colors hover:border-foreground/50 border-border"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-border flex items-center justify-center shrink-0" />
                                    <div>
                                        <div className="font-medium text-foreground">
                                            Import data from another platform
                                        </div>
                                        <div className="text-sm text-secondary mt-0.5">
                                            Import a copy of your data from another platform using one
                                            of our integrations.
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <DialogFooter className="border-t border-border p-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleMethodSelect("upload")}
                                disabled={!method}
                            >
                                Next
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* Step 2: File Upload */}
                {step === "upload" && (
                    <>
                        <DialogHeader className="p-6 pb-4">
                            <DialogTitle className="text-foreground">
                                Import products by Excel
                            </DialogTitle>
                            <DialogDescription className="text-secondary">
                                Upload your Avelero-formatted Excel file.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-6 pb-6">
                            <div
                                onClick={handleClick}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={cn(
                                    "border-2 border-dashed p-8 text-center transition-colors duration-200 cursor-pointer",
                                    isDragging
                                        ? "border-brand bg-accent"
                                        : "border-border hover:border-tertiary hover:bg-accent",
                                    isUploading && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Icons.Loader className="w-8 h-8 animate-spin text-tertiary" />
                                        <p className="type-small text-tertiary">Uploading...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Icons.Upload className="w-8 h-8 mx-auto mb-2 text-tertiary" />
                                        <p className="type-p text-primary font-medium">
                                            Drop your Excel file here, or click to browse.
                                        </p>
                                        <p className="type-small text-tertiary mt-1">
                                            Accepts .xlsx and .xls files (50MB limit)
                                        </p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                disabled={isUploading}
                            />
                        </div>

                        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                            <a
                                href={TEMPLATE_DOWNLOAD_URL}
                                className="text-sm text-brand hover:underline flex items-center gap-1"
                            >
                                <Icons.Download className="w-4 h-4" />
                                Download sample Excel
                            </a>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleBack}>
                                    Back
                                </Button>
                                <Button disabled>Next</Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 3: Import Options */}
                {step === "options" && file && (
                    <>
                        <DialogHeader className="p-6 pb-4">
                            <DialogTitle className="text-foreground">
                                Import products by Excel
                            </DialogTitle>
                            <DialogDescription className="text-secondary">
                                Configure your import options.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-6 pb-6 space-y-4">
                            {/* Selected File */}
                            <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border">
                                <Icons.Check className="w-4 h-4 text-brand shrink-0" />
                                <span className="text-sm text-foreground truncate flex-1">
                                    {file.name}
                                </span>
                                <Button variant="outline" size="sm" onClick={handleBack}>
                                    Replace file
                                </Button>
                            </div>

                            {/* Import Options */}
                            <div className="space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={mode === "CREATE_AND_ENRICH"}
                                        onChange={(e) =>
                                            setMode(e.target.checked ? "CREATE_AND_ENRICH" : "CREATE")
                                        }
                                        className="w-4 h-4 mt-0.5 rounded border-border text-brand focus:ring-brand"
                                    />
                                    <div>
                                        <div className="font-medium text-foreground text-sm">
                                            Overwrite products with matching handles
                                        </div>
                                        <div className="text-sm text-secondary mt-0.5">
                                            Existing values will be replaced for all columns included
                                            in the Excel.
                                        </div>
                                    </div>
                                </label>

                                {mode === "CREATE_AND_ENRICH" && (
                                    <div className="ml-7 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                        <p className="text-sm text-amber-800 dark:text-amber-200">
                                            <strong>Note:</strong> To enrich existing products, export
                                            your products first to get the required variant UPIDs.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                            <a
                                href={TEMPLATE_DOWNLOAD_URL}
                                className="text-sm text-brand hover:underline flex items-center gap-1"
                            >
                                <Icons.Download className="w-4 h-4" />
                                Download sample Excel
                            </a>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleBack}>
                                    Back
                                </Button>
                                <Button onClick={handleProceedToConfirmation}>Next</Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 4: Confirmation */}
                {step === "confirmation" && file && (
                    <>
                        <DialogHeader className="p-6 pb-4">
                            <DialogTitle className="text-foreground">
                                Confirm import
                            </DialogTitle>
                            <DialogDescription className="text-secondary">
                                Review your import settings before proceeding.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-6 pb-6 space-y-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>What will happen:</strong> {getModeDescription()}
                                </p>
                            </div>

                            <div className="border border-border divide-y divide-border">
                                <div className="p-3 flex items-center justify-between">
                                    <span className="text-sm text-secondary">File</span>
                                    <span className="text-sm text-foreground font-medium">
                                        {file.name}
                                    </span>
                                </div>
                                <div className="p-3 flex items-center justify-between">
                                    <span className="text-sm text-secondary">Mode</span>
                                    <span className="text-sm text-foreground font-medium">
                                        {mode === "CREATE_AND_ENRICH"
                                            ? "Create & Enrich"
                                            : "Create only"}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-secondary">
                                The import will run in the background. You'll be notified when
                                it completes.
                            </p>
                        </div>

                        <DialogFooter className="border-t border-border p-4 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                disabled={isImporting}
                            >
                                Back
                            </Button>
                            <Button onClick={handleStartImport} disabled={isImporting}>
                                {isImporting ? "Starting..." : "Import products"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
