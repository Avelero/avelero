"use client";

import { useImageUpload } from "@/hooks/use-upload";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { normalizeUrl } from "@/utils/validation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { DatePicker } from "@v1/ui/date-picker";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Sheet,
  SheetBreadcrumbHeader,
  SheetContent,
  SheetFooter,
} from "@v1/ui/sheet";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { CountrySelect } from "../select/country-select";

export interface CertificationSheetData {
  id: string;
  title: string;
  certificationCode?: string;
  instituteName?: string;
  instituteEmail?: string;
  instituteWebsite?: string;
  instituteAddressLine1?: string;
  instituteAddressLine2?: string;
  instituteCity?: string;
  instituteState?: string;
  instituteZip?: string;
  instituteCountryCode?: string;
  issueDate?: Date;
  expiryDate?: Date;
  certificationPath?: string;
}

interface CertificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle?: string;
  initialCertification?: CertificationSheetData;
  onCertificationCreated?: (certification: CertificationSheetData) => void;
  onSave?: (certification: CertificationSheetData) => void | Promise<void>;
}

function serializeDate(date?: Date) {
  if (!date) return undefined;
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    ),
  ).toISOString();
}

export function CertificationSheet({
  open,
  onOpenChange,
  initialTitle = "",
  initialCertification,
  onCertificationCreated,
  onSave,
}: CertificationSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useUserQuery();
  const brandId = user?.brand_id;
  const { uploadImage, buildPath, isLoading: isUploading } = useImageUpload();

  const createCertificationMutation = useMutation(
    trpc.catalog.certifications.create.mutationOptions(),
  );
  const updateCertificationMutation = useMutation(
    trpc.catalog.certifications.update.mutationOptions(),
  );

  const isEditMode = !!initialCertification;

  const [title, setTitle] = React.useState("");
  const [certificationCode, setCertificationCode] = React.useState("");
  const [instituteName, setInstituteName] = React.useState("");
  const [instituteEmail, setInstituteEmail] = React.useState("");
  const [instituteWebsite, setInstituteWebsite] = React.useState("");
  const [instituteAddressLine1, setInstituteAddressLine1] = React.useState("");
  const [instituteAddressLine2, setInstituteAddressLine2] = React.useState("");
  const [instituteCity, setInstituteCity] = React.useState("");
  const [instituteState, setInstituteState] = React.useState("");
  const [instituteZip, setInstituteZip] = React.useState("");
  const [instituteCountryCode, setInstituteCountryCode] = React.useState("");
  const [issueDate, setIssueDate] = React.useState<Date | undefined>(undefined);
  const [expiryDate, setExpiryDate] = React.useState<Date | undefined>(undefined);
  const [certificationPath, setCertificationPath] = React.useState<string | undefined>(
    undefined,
  );
  const [uploadedFileName, setUploadedFileName] = React.useState<string | undefined>(
    undefined,
  );
  const [isDragging, setIsDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [sheetContainer, setSheetContainer] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setTitle(initialCertification?.title ?? initialTitle);
    setCertificationCode(initialCertification?.certificationCode ?? "");
    setInstituteName(initialCertification?.instituteName ?? "");
    setInstituteEmail(initialCertification?.instituteEmail ?? "");
    setInstituteWebsite(initialCertification?.instituteWebsite ?? "");
    setInstituteAddressLine1(initialCertification?.instituteAddressLine1 ?? "");
    setInstituteAddressLine2(initialCertification?.instituteAddressLine2 ?? "");
    setInstituteCity(initialCertification?.instituteCity ?? "");
    setInstituteState(initialCertification?.instituteState ?? "");
    setInstituteZip(initialCertification?.instituteZip ?? "");
    setInstituteCountryCode(initialCertification?.instituteCountryCode ?? "");
    setIssueDate(initialCertification?.issueDate);
    setExpiryDate(initialCertification?.expiryDate);
    setCertificationPath(initialCertification?.certificationPath);
    setUploadedFileName(undefined);
  }, [open, initialCertification, initialTitle]);

  React.useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setTitle("");
      setCertificationCode("");
      setInstituteName("");
      setInstituteEmail("");
      setInstituteWebsite("");
      setInstituteAddressLine1("");
      setInstituteAddressLine2("");
      setInstituteCity("");
      setInstituteState("");
      setInstituteZip("");
      setInstituteCountryCode("");
      setIssueDate(undefined);
      setExpiryDate(undefined);
      setCertificationPath(undefined);
      setUploadedFileName(undefined);
      setIsDragging(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [open]);

  const validateAndUploadFile = React.useCallback(
    async (file: File) => {
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      const maxSize = 50 * 1024 * 1024;

      if (!allowedTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload a PDF, JPG, JPEG, or PNG file.");
        return;
      }
      if (file.size > maxSize) {
        toast.error("File too large. Please upload a file smaller than 50MB.");
        return;
      }
      if (!brandId) {
        toast.error("Unable to upload - no active brand selected.");
        return;
      }

      try {
        const path = buildPath([brandId], file);
        const result = await uploadImage({
          file,
          path,
          bucket: "certifications",
          isPublic: true,
          validation: (f) => {
            if (!allowedTypes.includes(f.type)) {
              return {
                valid: false,
                error:
                  "Invalid file type. Please upload a PDF, JPG, JPEG, or PNG file.",
              };
            }
            if (f.size > maxSize) {
              return {
                valid: false,
                error: "File too large. Please upload a file smaller than 50MB.",
              };
            }
            return { valid: true };
          },
        });
        setCertificationPath(result.displayUrl);
        setUploadedFileName(file.name);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to upload certificate. Please try again.",
        );
      }
    },
    [brandId, buildPath, uploadImage],
  );

  const handleSave = React.useCallback(async () => {
    if (!title.trim()) {
      toast.error("Certification title is required");
      return;
    }

    const normalizedWebsite = instituteWebsite.trim()
      ? normalizeUrl(instituteWebsite)
      : undefined;

    try {
      const issueDateIso = serializeDate(issueDate);
      const expiryDateIso = serializeDate(expiryDate);

      const result = await toast.loading(
        isEditMode ? "Saving certification..." : "Creating certification...",
        (async () => {
          if (isEditMode) {
            return updateCertificationMutation.mutateAsync({
              id: initialCertification.id,
              title: title.trim(),
              certification_code: certificationCode.trim() || null,
              institute_name: instituteName.trim() || null,
              institute_email: instituteEmail.trim() || null,
              institute_website: normalizedWebsite || null,
              institute_address_line_1: instituteAddressLine1.trim() || null,
              institute_address_line_2: instituteAddressLine2.trim() || null,
              institute_city: instituteCity.trim() || null,
              institute_state: instituteState.trim() || null,
              institute_zip: instituteZip.trim() || null,
              institute_country_code: instituteCountryCode || null,
              issue_date: issueDateIso || null,
              expiry_date: expiryDateIso || null,
              certification_path: certificationPath || null,
            });
          }

          return createCertificationMutation.mutateAsync({
            title: title.trim(),
            certification_code: certificationCode.trim() || undefined,
            institute_name: instituteName.trim() || undefined,
            institute_email: instituteEmail.trim() || undefined,
            institute_website: normalizedWebsite || undefined,
            institute_address_line_1: instituteAddressLine1.trim() || undefined,
            institute_address_line_2: instituteAddressLine2.trim() || undefined,
            institute_city: instituteCity.trim() || undefined,
            institute_state: instituteState.trim() || undefined,
            institute_zip: instituteZip.trim() || undefined,
            institute_country_code: instituteCountryCode || undefined,
            issue_date: issueDateIso,
            expiry_date: expiryDateIso,
            certification_path: certificationPath || undefined,
          });
        })(),
        {
          delay: 500,
          successMessage: isEditMode
            ? "Certification saved successfully"
            : "Certification created successfully",
        },
      );

      const saved = result?.data;
      if (!saved?.id) {
        throw new Error("No valid response returned from API");
      }

      const certificationId = saved.id;
      const now = new Date().toISOString();
      const nextCertification: CertificationSheetData = {
        id: certificationId,
        title: title.trim(),
        certificationCode: certificationCode.trim() || undefined,
        instituteName: instituteName.trim() || undefined,
        instituteEmail: instituteEmail.trim() || undefined,
        instituteWebsite: normalizedWebsite || undefined,
        instituteAddressLine1: instituteAddressLine1.trim() || undefined,
        instituteAddressLine2: instituteAddressLine2.trim() || undefined,
        instituteCity: instituteCity.trim() || undefined,
        instituteState: instituteState.trim() || undefined,
        instituteZip: instituteZip.trim() || undefined,
        instituteCountryCode: instituteCountryCode || undefined,
        issueDate: issueDate,
        expiryDate: expiryDate,
        certificationPath: certificationPath || undefined,
      };

      queryClient.setQueryData(trpc.composite.catalogContent.queryKey(), (old: any) => {
        if (!old) return old;
        const existing = old.brandCatalog?.certifications ?? [];
        const nextRow = {
          id: certificationId,
          title: nextCertification.title,
          certification_code: nextCertification.certificationCode ?? null,
          institute_name: nextCertification.instituteName ?? null,
          institute_email: nextCertification.instituteEmail ?? null,
          institute_website: nextCertification.instituteWebsite ?? null,
          institute_address_line_1: nextCertification.instituteAddressLine1 ?? null,
          institute_address_line_2: nextCertification.instituteAddressLine2 ?? null,
          institute_city: nextCertification.instituteCity ?? null,
          institute_state: nextCertification.instituteState ?? null,
          institute_zip: nextCertification.instituteZip ?? null,
          institute_country_code: nextCertification.instituteCountryCode ?? null,
          issue_date: issueDateIso ?? null,
          expiry_date: expiryDateIso ?? null,
          certification_path: nextCertification.certificationPath ?? null,
          created_at:
            existing.find((cert: any) => cert.id === certificationId)?.created_at ?? now,
          updated_at: now,
        };

        return {
          ...old,
          brandCatalog: {
            ...old.brandCatalog,
            certifications: isEditMode
              ? existing.map((cert: any) => (cert.id === certificationId ? nextRow : cert))
              : [...existing, nextRow],
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: trpc.composite.catalogContent.queryKey() });

      if (isEditMode) {
        await onSave?.(nextCertification);
      } else {
        onCertificationCreated?.(nextCertification);
        await onSave?.(nextCertification);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save certification:", error);
    }
  }, [
    certificationCode,
    certificationPath,
    createCertificationMutation,
    expiryDate,
    initialCertification,
    instituteAddressLine1,
    instituteAddressLine2,
    instituteCity,
    instituteCountryCode,
    instituteEmail,
    instituteName,
    instituteState,
    instituteWebsite,
    instituteZip,
    isEditMode,
    issueDate,
    onCertificationCreated,
    onOpenChange,
    onSave,
    queryClient,
    title,
    trpc,
    updateCertificationMutation,
  ]);

  const handleClick = () => fileInputRef.current?.click();
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
    const file = e.dataTransfer.files?.[0];
    if (file) void validateAndUploadFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void validateAndUploadFile(file);
  };

  const isSaving =
    createCertificationMutation.isPending ||
    updateCertificationMutation.isPending ||
    isUploading;
  const isValid = title.trim().length > 0 && !isUploading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={setSheetContainer}
        side="right"
        className="m-6 flex h-[calc(100vh-48px)] w-full flex-col gap-0 p-0 sm:w-[480px] lg:w-[560px]"
        hideDefaultClose
      >
        <SheetBreadcrumbHeader
          pages={[isEditMode ? "Edit certification" : "Create certification"]}
          currentPageIndex={0}
          onClose={() => onOpenChange(false)}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cert-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cert-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="GOTS"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-code">Certification code</Label>
                <Input
                  id="cert-code"
                  value={certificationCode}
                  onChange={(e) => setCertificationCode(e.target.value)}
                  placeholder="GOTS-12345"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cert-issue-date">Issue date</Label>
                <DatePicker
                  value={issueDate || null}
                  onChange={(date) => setIssueDate(date || undefined)}
                  placeholder="Select date"
                  inline
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-expiry-date">Expiry date</Label>
                <DatePicker
                  value={expiryDate || null}
                  onChange={(date) => setExpiryDate(date || undefined)}
                  placeholder="Select date"
                  inline
                />
              </div>
            </div>

            <div className="my-1 border-t border-border" />

            <div className="space-y-1.5">
              <Label htmlFor="cert-institute-name">Institute name</Label>
              <Input
                id="cert-institute-name"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                placeholder="Global Organic Textile Standard"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-institute-email">Institute email</Label>
              <Input
                id="cert-institute-email"
                type="email"
                value={instituteEmail}
                onChange={(e) => setInstituteEmail(e.target.value)}
                placeholder="info@global-standard.org"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-institute-website">Institute website</Label>
              <Input
                id="cert-institute-website"
                value={instituteWebsite}
                onChange={(e) => setInstituteWebsite(e.target.value)}
                placeholder="https://global-standard.org"
                className="h-9"
              />
            </div>

            <div className="my-1 border-t border-border" />

            <div className="space-y-1.5">
              <Label htmlFor="cert-address-1">Address line 1</Label>
              <Input
                id="cert-address-1"
                value={instituteAddressLine1}
                onChange={(e) => setInstituteAddressLine1(e.target.value)}
                placeholder="123 Certification Street"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-address-2">Address line 2</Label>
              <Input
                id="cert-address-2"
                value={instituteAddressLine2}
                onChange={(e) => setInstituteAddressLine2(e.target.value)}
                placeholder="Building A"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CountrySelect
                id="cert-country"
                label="Country"
                placeholder="Select country"
                value={instituteCountryCode}
                onChange={(code) => setInstituteCountryCode(code)}
                container={sheetContainer}
              />
              <div className="space-y-1.5">
                <Label htmlFor="cert-city">City</Label>
                <Input
                  id="cert-city"
                  value={instituteCity}
                  onChange={(e) => setInstituteCity(e.target.value)}
                  placeholder="Stuttgart"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cert-state">Province / state</Label>
                <Input
                  id="cert-state"
                  value={instituteState}
                  onChange={(e) => setInstituteState(e.target.value)}
                  placeholder="Baden-Württemberg"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-zip">Postal code / ZIP code</Label>
                <Input
                  id="cert-zip"
                  value={instituteZip}
                  onChange={(e) => setInstituteZip(e.target.value)}
                  placeholder="70173"
                  className="h-9"
                />
              </div>
            </div>

            <div className="my-1 border-t border-border" />

            <div className="space-y-1.5">
              <Label>Certificate document</Label>
              {uploadedFileName || certificationPath ? (
                <div className="flex items-center gap-2 border border-border bg-background p-3">
                  <Icons.Check className="h-4 w-4 shrink-0 text-brand" />
                  <span className="flex-1 truncate type-small text-primary">
                    {uploadedFileName ?? certificationPath}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCertificationPath(undefined);
                      setUploadedFileName(undefined);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-tertiary transition-colors hover:text-destructive"
                    aria-label="Remove certificate"
                  >
                    <Icons.X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={handleClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "cursor-pointer border border-dashed p-8 text-center transition-colors duration-200",
                    isDragging
                      ? "border-brand bg-accent"
                      : "border-border hover:border-tertiary hover:bg-accent",
                    isUploading && "cursor-not-allowed opacity-50",
                  )}
                >
                  {isUploading ? (
                    <p className="type-small text-tertiary">Uploading...</p>
                  ) : (
                    <>
                      <p className="mb-1 type-small text-tertiary">
                        Drop your certificate here, or click to browse.
                      </p>
                      <p className="type-small text-tertiary">50MB file limit.</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            size="default"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="w-[70px]"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            size="default"
            onClick={() => void handleSave()}
            disabled={!isValid || isSaving}
            className="w-[70px]"
          >
            {isEditMode ? "Save" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
