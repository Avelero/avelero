"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useImageUpload } from "@/hooks/use-upload";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { formatPhone, normalizeUrl } from "@/utils/validation";
import { BooleanToggle } from "@v1/ui/boolean";
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
import { Switch } from "@v1/ui/switch";
import * as React from "react";
import { CountrySelect } from "../select/country-select";

/**
 * Material data shape returned when a material is created.
 */
interface MaterialData {
  /** Unique material identifier */
  id: string;
  /** Material name (e.g., "Organic Cotton", "Recycled Polyester") */
  name: string;
  /** ISO country code of origin */
  countryOfOrigin?: string;
  /** Whether the material is recyclable */
  recyclable?: boolean;
  /** Optional certification reference */
  certificationId?: string;
  /** Full certification details if attached */
  certification?: CertificationData;
}

/**
 * Certification data shape for materials.
 */
interface CertificationData {
  /** Unique certification identifier */
  id: string;
  /** Certification title */
  title: string;
  /** Certification code (e.g., "GOTS", "OEKO-TEX") */
  certificationCode?: string;
  /** Name of issuing institution */
  instituteName?: string;
  /** Institute email */
  instituteEmail?: string;
  /** Institute website */
  instituteWebsite?: string;
  /** Institute address line 1 */
  instituteAddressLine1?: string;
  /** Institute address line 2 */
  instituteAddressLine2?: string;
  /** Institute city */
  instituteCity?: string;
  /** Institute state */
  instituteState?: string;
  /** Institute zip */
  instituteZip?: string;
  /** Institute country code */
  instituteCountryCode?: string;
  /** Issue date */
  issueDate?: Date;
  /** Expiration date */
  expiryDate?: Date;
  /** File path for certificate document */
  filePath?: string;
}

/**
 * Props for the MaterialSheet component.
 */
interface MaterialSheetProps {
  /** Controls sheet visibility */
  open: boolean;
  /** Callback when sheet open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional pre-filled material name */
  initialName?: string;
  /** Callback invoked with the created material data */
  onMaterialCreated: (material: MaterialData) => void;
}

/** Internal page state for multi-page sheet flow */
type Page = "material" | "certification";

/**
 * Multi-page sheet for creating materials with optional certifications.
 *
 * This component manages a two-page flow:
 * 1. Material details page - Name, country, recyclability, certification selection
 * 2. Certification creation page - Appears when user creates a new certification
 *
 * Supports file uploads for certification documents and maintains complex state
 * across page transitions. All form data is reset when the sheet closes.
 *
 * @param props - Sheet configuration and callbacks
 *
 * @example
 * ```tsx
 * <MaterialSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   initialName="Organic Cotton"
 *   onMaterialCreated={(material) => {
 *     console.log('Created:', material);
 *   }}
 * />
 * ```
 */
export function MaterialSheet({
  open,
  onOpenChange,
  initialName = "",
  onMaterialCreated,
}: MaterialSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { certifications: apiCertifications } = useBrandCatalog();
  const [currentPage, setCurrentPage] = React.useState<Page>("material");

  // Material form state
  const [name, setName] = React.useState(initialName);
  const [countryOfOrigin, setCountryOfOrigin] = React.useState("");
  const [recyclable, setRecyclable] = React.useState<boolean | undefined>(
    undefined,
  );
  const [certified, setCertified] = React.useState(false);
  const [selectedCertificationId, setSelectedCertificationId] = React.useState<
    string | null
  >(null);
  const [certSearchTerm, setCertSearchTerm] = React.useState("");

  // Transform API certifications to CertificationData format
  const availableCertifications = React.useMemo<CertificationData[]>(() => {
    return apiCertifications.map((cert: any) => ({
      id: cert.id,
      title: cert.title,
      certificationCode: cert.certification_code || undefined,
      instituteName: cert.institute_name || undefined,
      instituteEmail: cert.institute_email || undefined,
      instituteWebsite: cert.institute_website || undefined,
      instituteAddressLine1: cert.institute_address_line_1 || undefined,
      instituteAddressLine2: cert.institute_address_line_2 || undefined,
      instituteCity: cert.institute_city || undefined,
      instituteState: cert.institute_state || undefined,
      instituteZip: cert.institute_zip || undefined,
      instituteCountryCode: cert.institute_country_code || undefined,
      issueDate: cert.issue_date ? new Date(cert.issue_date) : undefined,
      expiryDate: cert.expiry_date ? new Date(cert.expiry_date) : undefined,
      filePath: cert.file_path || undefined,
    }));
  }, [apiCertifications]);

  // Certification form state
  const [certTitle, setCertTitle] = React.useState("");
  const [certCode, setCertCode] = React.useState("");
  const [certInstituteName, setCertInstituteName] = React.useState("");
  const [certInstituteEmail, setCertInstituteEmail] = React.useState("");
  const [certInstituteWebsite, setCertInstituteWebsite] = React.useState("");
  const [certInstituteAddressLine1, setCertInstituteAddressLine1] =
    React.useState("");
  const [certInstituteAddressLine2, setCertInstituteAddressLine2] =
    React.useState("");
  const [certInstituteCity, setCertInstituteCity] = React.useState("");
  const [certInstituteState, setCertInstituteState] = React.useState("");
  const [certInstituteZip, setCertInstituteZip] = React.useState("");
  const [certInstituteCountryCode, setCertInstituteCountryCode] =
    React.useState("");
  const [certIssueDate, setCertIssueDate] = React.useState<Date | undefined>(
    undefined,
  );
  const [certExpiryDate, setCertExpiryDate] = React.useState<Date | undefined>(
    undefined,
  );
  const [certFilePath, setCertFilePath] = React.useState<string | undefined>(
    undefined,
  );
  const [uploadedFileName, setUploadedFileName] = React.useState<
    string | undefined
  >(undefined);

  // File upload state
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadImage, buildPath, isLoading: isUploading } = useImageUpload();

  // API mutations
  const createMaterialMutation = useMutation(
    trpc.brand.materials.create.mutationOptions(),
  );
  const createCertificationMutation = useMutation(
    trpc.brand.certifications.create.mutationOptions(),
  );

  // Compute loading state from mutations and uploads
  const isCreating =
    createMaterialMutation.isPending ||
    createCertificationMutation.isPending ||
    isUploading;

  // Update name when initialName changes (when sheet opens with pre-filled name)
  React.useEffect(() => {
    if (open && initialName) {
      setName(initialName);
    }
  }, [open, initialName]);

  // Reset form when sheet closes (delayed to avoid flash during animation)
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setCurrentPage("material");
        setName("");
        setCountryOfOrigin("");
        setRecyclable(undefined);
        setCertified(false);
        setSelectedCertificationId(null);
        setCertSearchTerm("");
        resetCertificationForm();
      }, 350); // Wait for sheet close animation
      return () => clearTimeout(timer);
    }
  }, [open]);

  const resetCertificationForm = () => {
    setCertTitle("");
    setCertCode("");
    setCertInstituteName("");
    setCertInstituteEmail("");
    setCertInstituteWebsite("");
    setCertInstituteAddressLine1("");
    setCertInstituteAddressLine2("");
    setCertInstituteCity("");
    setCertInstituteState("");
    setCertInstituteZip("");
    setCertInstituteCountryCode("");
    setCertIssueDate(undefined);
    setCertExpiryDate(undefined);
    setCertFilePath(undefined);
    setUploadedFileName(undefined);
  };

  const handleCreateCertification = (prefillName?: string) => {
    // Pre-fill certification name if provided from search
    if (prefillName) {
      setCertTitle(prefillName);
    }
    // Clear search term when navigating to create page
    setCertSearchTerm("");
    // Navigate to certification page
    setCurrentPage("certification");
  };

  const handleBackToMaterial = () => {
    // Reset certification form
    resetCertificationForm();
    setCurrentPage("material");
  };

  const handleCertificationCreate = async () => {
    // Validate required fields
    if (!certTitle.trim()) {
      toast.error("Certification title is required");
      return;
    }

    // Normalize URL if provided
    const normalizedWebsite = certInstituteWebsite.trim()
      ? normalizeUrl(certInstituteWebsite)
      : undefined;

    try {
      // Serialize dates as ISO strings
      const issueDateISO = certIssueDate
        ? new Date(
            Date.UTC(
              certIssueDate.getFullYear(),
              certIssueDate.getMonth(),
              certIssueDate.getDate(),
              0,
              0,
              0,
              0,
            ),
          ).toISOString()
        : undefined;

      const expiryDateISO = certExpiryDate
        ? new Date(
            Date.UTC(
              certExpiryDate.getFullYear(),
              certExpiryDate.getMonth(),
              certExpiryDate.getDate(),
              0,
              0,
              0,
              0,
            ),
          ).toISOString()
        : undefined;

      // Create certification via API
      const result = await createCertificationMutation.mutateAsync({
        title: certTitle.trim(),
        certification_code: certCode.trim() || undefined,
        institute_name: certInstituteName.trim() || undefined,
        institute_email: certInstituteEmail.trim() || undefined,
        institute_website: normalizedWebsite || undefined,
        institute_address_line_1:
          certInstituteAddressLine1.trim() || undefined,
        institute_address_line_2:
          certInstituteAddressLine2.trim() || undefined,
        institute_city: certInstituteCity.trim() || undefined,
        institute_state: certInstituteState.trim() || undefined,
        institute_zip: certInstituteZip.trim() || undefined,
        institute_country_code: certInstituteCountryCode || undefined,
        issue_date: issueDateISO,
        expiry_date: expiryDateISO,
        file_path: certFilePath || undefined,
      });

      // Validate response
      const createdCertification = result?.data;
      if (!createdCertification?.id) {
        throw new Error("No valid response returned from API");
      }

      const certificationId = createdCertification.id;

      // Optimistically update the cache immediately
      const now = new Date().toISOString();
      queryClient.setQueryData(
        trpc.composite.brandCatalogContent.queryKey(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              certifications: [
                ...old.brandCatalog.certifications,
                {
                  id: certificationId,
                  title: certTitle.trim(),
                  certification_code: certCode.trim() || null,
                  institute_name: certInstituteName.trim() || null,
                  institute_email: certInstituteEmail.trim() || null,
                  institute_website: normalizedWebsite || null,
                  institute_address_line_1:
                    certInstituteAddressLine1.trim() || null,
                  institute_address_line_2:
                    certInstituteAddressLine2.trim() || null,
                  institute_city: certInstituteCity.trim() || null,
                  institute_state: certInstituteState.trim() || null,
                  institute_zip: certInstituteZip.trim() || null,
                  institute_country_code: certInstituteCountryCode || null,
                  issue_date: issueDateISO || null,
                  expiry_date: expiryDateISO || null,
                  file_path: certFilePath || null,
                  created_at: now,
                  updated_at: now,
                },
              ],
            },
          };
        },
      );

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.brandCatalogContent.queryKey(),
      });

      // Set as selected certification
      setSelectedCertificationId(certificationId);

      // Navigate back to material page
      handleBackToMaterial();
    } catch (error) {
      console.error("Failed to create certification:", error);
      toast.error("Failed to create certification. Please try again.");
    }
  };

  const handleMaterialCreate = async () => {
    if (!name.trim()) {
      return;
    }

    // Validate certification requirement
    if (certified && !selectedCertificationId) {
      toast.error("Please select a certification before saving");
      return;
    }

    // Show loading toast and execute mutation
    await toast
      .loading(
        "Creating material...",
        (async () => {
          // Create material via API
          const result = await createMaterialMutation.mutateAsync({
            name: name.trim(),
            country_of_origin: countryOfOrigin || undefined,
            recyclable,
            certification_id: selectedCertificationId || undefined,
          });

          // Validate response
          const createdMaterial = result?.data;
          if (!createdMaterial?.id) {
            throw new Error("No valid response returned from API");
          }

          const materialId = createdMaterial.id;

          // Optimistically update the cache immediately
          const now = new Date().toISOString();
          queryClient.setQueryData(
            trpc.composite.brandCatalogContent.queryKey(),
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                brandCatalog: {
                  ...old.brandCatalog,
                  materials: [
                    ...old.brandCatalog.materials,
                    {
                      id: materialId,
                      name: name.trim(),
                      country_of_origin: countryOfOrigin || null,
                      recyclable: recyclable ?? null,
                      certification_id: selectedCertificationId || null,
                      created_at: now,
                      updated_at: now,
                    },
                  ],
                },
              };
            },
          );

          // Invalidate to trigger background refetch
          queryClient.invalidateQueries({
            queryKey: trpc.composite.brandCatalogContent.queryKey(),
          });

          // Find selected certification data if one is selected
          const selectedCert = availableCertifications.find(
            (c) => c.id === selectedCertificationId,
          );

          // Build material data with real ID for parent callback
          const newMaterial: MaterialData = {
            id: materialId,
            name: name.trim(),
            countryOfOrigin: countryOfOrigin || undefined,
            recyclable,
            certificationId: selectedCertificationId || undefined,
            certification: selectedCert || undefined,
          };

          // Call parent callback with real data
          onMaterialCreated(newMaterial);

          // Close sheet first
          onOpenChange(false);

          return result;
        })(),
        {
          delay: 500,
          successMessage: "Material created successfully",
        },
      )
      .catch((error) => {
        console.error("Failed to create material:", error);
      });
  };

  const handleCancel = () => {
    if (currentPage === "certification") {
      handleBackToMaterial();
    } else {
      onOpenChange(false);
    }
  };

  // File upload handlers
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndUploadFile = async (file: File) => {
    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        "Invalid file type. Please upload a PDF, JPG, JPEG, or PNG file.",
      );
      return;
    }

    // Validate file size (4MB limit)
    const maxSize = 4 * 1024 * 1024; // 4MB in bytes
    if (file.size > maxSize) {
      toast.error("File too large. Please upload a file smaller than 4MB.");
      return;
    }

    try {
      const path = buildPath(["certifications"], file);
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
              error: "File too large. Please upload a file smaller than 4MB.",
            };
          }
          return { valid: true };
        },
      });

      setCertFilePath(result.displayUrl);
      setUploadedFileName(file.name);
      toast.success("Certificate uploaded successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to upload certificate. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file) {
        validateAndUploadFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        validateAndUploadFile(file);
      }
    }
  };

  const isNameValid = name.trim().length > 0;
  const isMaterialValid =
    isNameValid && (!certified || selectedCertificationId) && !isUploading;
  const isCertificationValid = certTitle.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        {/* Header */}
        <SheetBreadcrumbHeader
          pages={["Create material", "Create certification"]}
          currentPageIndex={currentPage === "material" ? 0 : 1}
          onClose={() => onOpenChange(false)}
          onPageClick={(pageIndex) => {
            if (pageIndex === 0) {
              handleBackToMaterial();
            }
          }}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          {currentPage === "material" ? (
            <div className="flex flex-col gap-3">
              {/* Material Name */}
              <div className="space-y-1.5">
                <Label htmlFor="material-name">
                  Material <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="material-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Organic Cotton"
                  className="h-9"
                />
              </div>

              {/* Origin & Recyclable */}
              <div className="grid grid-cols-2 gap-3">
                <CountrySelect
                  id="material-origin"
                  label="Origin"
                  placeholder="Select country"
                  value={countryOfOrigin}
                  onChange={(code) => setCountryOfOrigin(code)}
                />

                <div className="space-y-1.5">
                  <Label>Recyclable</Label>
                  <BooleanToggle
                    value={recyclable ?? false}
                    onChange={setRecyclable}
                    leftLabel="No"
                    rightLabel="Yes"
                  />
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-border my-1" />

              {/* Certified Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <p className="type-p !font-medium text-primary">
                      Certified
                    </p>
                    <p className="type-small text-tertiary">
                      Add a certification to this material, a copy of the
                      certificate is required. You'll receive an email 30 days
                      before the expiry date.
                    </p>
                  </div>
                  <Switch
                    checked={certified}
                    onCheckedChange={setCertified}
                    className="data-[state=checked]:bg-brand"
                  />
                </div>

                {/* Certification List */}
                {certified && (
                  <div className="space-y-3">
                    {/* Search bar */}
                    <div className="relative">
                      <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tertiary" />
                      <Input
                        placeholder="Search certifications..."
                        value={certSearchTerm}
                        onChange={(e) => setCertSearchTerm(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>

                    {/* Certification List */}
                    <div className="border border-border bg-background overflow-hidden max-h-[280px] overflow-y-auto">
                      {(() => {
                        // Filter certifications by search term
                        const filteredCerts = certSearchTerm
                          ? availableCertifications.filter(
                              (cert) =>
                                cert.title
                                  .toLowerCase()
                                  .includes(certSearchTerm.toLowerCase()) ||
                                cert.certificationCode
                                  ?.toLowerCase()
                                  .includes(certSearchTerm.toLowerCase()),
                            )
                          : availableCertifications;

                        // Check if search term doesn't match any existing certification
                        const showCreateOption =
                          certSearchTerm &&
                          !availableCertifications.some(
                            (cert) =>
                              cert.title.toLowerCase() ===
                                certSearchTerm.toLowerCase() ||
                              cert.certificationCode?.toLowerCase() ===
                                certSearchTerm.toLowerCase(),
                          );

                        return (
                          <>
                            {filteredCerts.length > 0 ? (
                              filteredCerts.map((cert, index) => (
                                <button
                                  key={cert.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedCertificationId(cert.id)
                                  }
                                  className={cn(
                                    "w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors border-b border-border",
                                    // Remove bottom border on last item only if there's no create option below
                                    index === filteredCerts.length - 1 &&
                                      !showCreateOption &&
                                      "border-b-0",
                                    selectedCertificationId === cert.id &&
                                      "bg-accent-blue",
                                  )}
                                >
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                    {selectedCertificationId === cert.id ? (
                                      <Icons.Check className="h-5 w-5 text-brand" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-secondary">
                                        {(
                                          cert.certificationCode ||
                                          cert.title.substring(0, 2)
                                        )
                                          .substring(0, 2)
                                          .toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 text-left mr-auto">
                                    <p className="type-p !leading-[14px] text-primary font-medium">
                                      {cert.title}
                                    </p>
                                    {cert.certificationCode && (
                                      <p className="type-small !leading-[14px] text-tertiary">
                                        {cert.certificationCode}
                                      </p>
                                    )}
                                  </div>
                                  {cert.expiryDate && (
                                    <div className="text-right">
                                      <p className="type-small !leading-[14px] text-tertiary">
                                        Expires on{" "}
                                        {cert.expiryDate.toLocaleDateString(
                                          "en-US",
                                          {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                          },
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </button>
                              ))
                            ) : availableCertifications.length === 0 &&
                              !certSearchTerm ? (
                              // Empty state - shown when no certifications exist and no search
                              <div className="flex flex-col items-center justify-center py-12 px-4">
                                <p className="type-p text-tertiary text-center mb-3">
                                  No certifications yet
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCreateCertification()}
                                >
                                  <Icons.Plus className="h-4 w-4" />
                                  <span className="px-1">
                                    Create certification
                                  </span>
                                </Button>
                              </div>
                            ) : null}

                            {/* Show "Create" option when search doesn't match */}
                            {showCreateOption && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCreateCertification(certSearchTerm)
                                }
                                className="w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors"
                              >
                                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                  <Icons.Plus className="h-4 w-4 text-tertiary" />
                                </div>
                                <span className="type-p text-primary">
                                  Create &quot;{certSearchTerm}&quot;
                                </span>
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Certification Creation Form
            <div className="flex flex-col gap-3">
              {/* Title & Certification Code */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cert-title"
                    value={certTitle}
                    onChange={(e) => setCertTitle(e.target.value)}
                    placeholder="GOTS"
                    className="h-9"
                    maxLength={100}
                    aria-required="true"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-code">Certification code</Label>
                  <Input
                    id="cert-code"
                    value={certCode}
                    onChange={(e) => setCertCode(e.target.value)}
                    placeholder="GOTS-12345"
                    className="h-9"
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Issue Date & Expiry Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-issue-date">Issue date</Label>
                  <DatePicker
                    value={certIssueDate || null}
                    onChange={(date) => setCertIssueDate(date || undefined)}
                    placeholder="Select date"
                    inline
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-expiry-date">Expiry date</Label>
                  <DatePicker
                    value={certExpiryDate || null}
                    onChange={(date) => setCertExpiryDate(date || undefined)}
                    placeholder="Select date"
                    inline
                  />
                </div>
              </div>

              {/* Separator line */}
              <div className="border-t border-border my-1" />

              {/* Institute Name */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-institute-name">Institute name</Label>
                <Input
                  id="cert-institute-name"
                  value={certInstituteName}
                  onChange={(e) => setCertInstituteName(e.target.value)}
                  placeholder="Global Organic Textile Standard"
                  className="h-9"
                  maxLength={100}
                />
              </div>

              {/* Institute Email */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-institute-email">Institute email</Label>
                <Input
                  id="cert-institute-email"
                  type="email"
                  value={certInstituteEmail}
                  onChange={(e) => setCertInstituteEmail(e.target.value)}
                  placeholder="info@global-standard.org"
                  className="h-9"
                  maxLength={100}
                />
              </div>

              {/* Institute Website */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-institute-website">Institute website</Label>
                <Input
                  id="cert-institute-website"
                  type="text"
                  value={certInstituteWebsite}
                  onChange={(e) => setCertInstituteWebsite(e.target.value)}
                  placeholder="https://global-standard.org"
                  className="h-9"
                  maxLength={200}
                />
              </div>

              {/* Separator line */}
              <div className="border-t border-border my-1" />

              {/* Address line 1 */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-address-1">Address line 1</Label>
                <Input
                  id="cert-address-1"
                  value={certInstituteAddressLine1}
                  onChange={(e) => setCertInstituteAddressLine1(e.target.value)}
                  placeholder="123 Certification Street"
                  className="h-9"
                  maxLength={500}
                />
              </div>

              {/* Address line 2 */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-address-2">Address line 2</Label>
                <Input
                  id="cert-address-2"
                  value={certInstituteAddressLine2}
                  onChange={(e) => setCertInstituteAddressLine2(e.target.value)}
                  placeholder="Building A"
                  className="h-9"
                  maxLength={500}
                />
              </div>

              {/* Country & City (2 columns) */}
              <div className="grid grid-cols-2 gap-3">
                <CountrySelect
                  id="cert-country"
                  label="Country"
                  placeholder="Select country"
                  value={certInstituteCountryCode}
                  onChange={(code) => setCertInstituteCountryCode(code)}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="cert-city">City</Label>
                  <Input
                    id="cert-city"
                    value={certInstituteCity}
                    onChange={(e) => setCertInstituteCity(e.target.value)}
                    placeholder="Stuttgart"
                    className="h-9"
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Province/state & Postal code (2 columns) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-state">Province / state</Label>
                  <Input
                    id="cert-state"
                    value={certInstituteState}
                    onChange={(e) => setCertInstituteState(e.target.value)}
                    placeholder="Baden-Württemberg"
                    className="h-9"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-zip">Postal code / ZIP code</Label>
                  <Input
                    id="cert-zip"
                    value={certInstituteZip}
                    onChange={(e) => setCertInstituteZip(e.target.value)}
                    placeholder="70173"
                    className="h-9"
                    maxLength={100}
                  />
                </div>
              </div>

              {/* Separator line */}
              <div className="border-t border-border my-1" />

              {/* Certificate Upload */}
              <div className="space-y-1.5">
                <Label>Certificate document</Label>
                {uploadedFileName ? (
                  <div className="flex items-center gap-2 p-3 border border-border bg-background">
                    <Icons.Check className="h-4 w-4 text-brand shrink-0" />
                    <span className="flex-1 type-small text-primary truncate">
                      {uploadedFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCertFilePath(undefined);
                        setUploadedFileName(undefined);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="text-tertiary hover:text-destructive transition-colors"
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
                      "border border-dashed p-8 text-center transition-colors duration-200 cursor-pointer",
                      isDragging
                        ? "border-brand bg-accent"
                        : "border-border hover:border-tertiary hover:bg-accent",
                      isUploading && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {isUploading ? (
                      <p className="type-small text-tertiary">Uploading...</p>
                    ) : (
                      <>
                        <p className="type-small text-tertiary mb-1">
                          Drop your certificate here, or click to browse.
                        </p>
                        <p className="type-small text-tertiary">
                          4MB file limit.
                        </p>
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
          )}
        </div>

        {/* Footer */}
        <SheetFooter>
          {currentPage === "material" ? (
            <>
              <Button
                variant="outline"
                size="default"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
                className="w-[70px]"
              >
                Cancel
              </Button>
              <Button
                variant="brand"
                size="default"
                onClick={handleMaterialCreate}
                disabled={!isMaterialValid || isCreating}
                className="w-[70px]"
              >
                Create
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="default"
                onClick={handleBackToMaterial}
                disabled={isCreating}
                className="w-[70px]"
              >
                Back
              </Button>
              <Button
                variant="brand"
                size="default"
                onClick={handleCertificationCreate}
                disabled={!isCertificationValid || isCreating}
                className="w-[70px]"
              >
                Create
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
