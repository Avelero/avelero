"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@/hooks/use-upload";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import type { Certification } from "@v1/selections/certifications";
import { allCertifications } from "@v1/selections/certifications";
import { BooleanToggle } from "@v1/ui/boolean";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { DatePicker } from "@v1/ui/date-picker";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Select } from "@v1/ui/select";
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
  code: string;
  /** Certification number/ID from issuing body */
  certificationNumber: string;
  /** Name of issuing institution */
  instituteName: string;
  /** Optional expiration date */
  expiryDate?: Date;
  /** Optional logo file path */
  logo?: string;
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
 * Supports file uploads for certification logos and maintains complex state
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
    return apiCertifications.map(cert => {
      // Find matching predefined certification for code
      const predefinedCert = allCertifications.find(
        c => c.title.toLowerCase() === cert.title.toLowerCase()
      );
      
      return {
        id: cert.id,
        title: cert.title,
        code: predefinedCert?.code || cert.certification_code || cert.title.substring(0, 4).toUpperCase(),
        certificationNumber: cert.certification_code || "",
        instituteName: cert.institute_name || "",
        expiryDate: cert.expiry_date ? new Date(cert.expiry_date) : undefined,
        logo: cert.file_asset_id || undefined,
      };
    });
  }, [apiCertifications]);

  // Certification form state
  const [certTitle, setCertTitle] = React.useState("");
  const [certCode, setCertCode] = React.useState("");
  const [certNumber, setCertNumber] = React.useState("");
  const [certInstitute, setCertInstitute] = React.useState("");
  const [certExpiry, setCertExpiry] = React.useState<Date | undefined>(
    undefined,
  );
  const [certLogo, setCertLogo] = React.useState<string | undefined>(undefined);
  const [uploadedFileName, setUploadedFileName] = React.useState<
    string | undefined
  >(undefined);

  // File upload state
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { uploadFile, isLoading: isUploading } = useUpload();

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
        setCertTitle("");
        setCertCode("");
        setCertNumber("");
        setCertInstitute("");
        setCertExpiry(undefined);
        setCertLogo(undefined);
        setUploadedFileName(undefined);
      }, 350); // Wait for sheet close animation
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleCreateCertification = (prefillName?: string) => {
    // Pre-fill certification name if provided from search
    if (prefillName) {
      // Check if it matches a predefined certification
      const matchedCert = allCertifications.find(
        (c) => c.title.toLowerCase() === prefillName.toLowerCase(),
      );
      if (matchedCert) {
        setCertTitle(matchedCert.title);
        setCertCode(matchedCert.code);
      } else {
        // Use custom name
        setCertTitle(prefillName);
      }
    }
    // Clear search term when navigating to create page
    setCertSearchTerm("");
    // Navigate to certification page
    setCurrentPage("certification");
  };

  const handleBackToMaterial = () => {
    // Reset certification form
    setCertTitle("");
    setCertCode("");
    setCertNumber("");
    setCertInstitute("");
    setCertExpiry(undefined);
    setCurrentPage("material");
  };

  const handleCertificationCreate = async () => {
    // Validate required fields and file upload
    if (!certTitle.trim() || !certNumber.trim() || !certExpiry || !certLogo || isUploading) {
      return;
    }

    // Show loading toast and execute mutation
    await toast.loading(
      "Creating certification...",
      (async () => {
        // Serialize expiry as date-only string (YYYY-MM-DD) using UTC
        // to avoid timezone-shifting issues
        // Use local date components to preserve the selected day, then construct UTC date
        const expiryDateISO = new Date(
          Date.UTC(
            certExpiry.getFullYear(),
            certExpiry.getMonth(),
            certExpiry.getDate(),
            0, 0, 0, 0
          )
        ).toISOString();

        // Create certification via API
        // certification_code comes from certCode (short code)
        // Store certNumber in notes field since API doesn't have a separate certification_number field
        const result = await createCertificationMutation.mutateAsync({
          title: certTitle.trim(),
          certification_code: certCode.trim() || certTitle.trim().substring(0, 4).toUpperCase(),
          institute_name: certInstitute.trim() || undefined,
          expiry_date: expiryDateISO,
          file_asset_id: certLogo || undefined,
          notes: certNumber.trim() || undefined,
        });

        // Validate response
        const createdCertification = result?.data;
        if (!createdCertification?.id) {
          throw new Error("No valid response returned from API");
        }
        
        const certificationId = createdCertification.id;

        // Optimistically update the cache immediately
        // Use input data + response ID + current timestamp
        const now = new Date().toISOString();
        queryClient.setQueryData(
          trpc.composite.passportFormReferences.queryKey(),
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
                    certification_code: certCode.trim() || certTitle.trim().substring(0, 4).toUpperCase(),
                    institute_name: certInstitute.trim() || null,
                    expiry_date: expiryDateISO,
                    file_asset_id: certLogo || null,
                    notes: certNumber.trim() || null,
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
          queryKey: trpc.composite.passportFormReferences.queryKey(),
        });

        // Create local certification data with real ID
        const newCert: CertificationData = {
          id: certificationId,
          title: certTitle.trim(),
          code: certCode.trim(),
          certificationNumber: certNumber.trim(),
          instituteName: certInstitute.trim(),
          expiryDate: certExpiry,
          logo: certLogo,
        };

        // Set as selected certification (will be available in availableCertifications after refetch)
        setSelectedCertificationId(certificationId);

        // Navigate back to material page
        handleBackToMaterial();

        return result;
      })(),
      {
        delay: 200,
        successMessage: "Certification created successfully",
      },
    ).catch((error) => {
      // toast.loading already handles error toast, but we can log for debugging
      console.error("Failed to create certification:", error);
    });
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
    await toast.loading(
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
        // Use input data + response ID + current timestamp
        const now = new Date().toISOString();
        queryClient.setQueryData(
          trpc.composite.passportFormReferences.queryKey(),
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
          queryKey: trpc.composite.passportFormReferences.queryKey(),
        });

        // Find selected certification data if one is selected
        const selectedCert = availableCertifications.find(
          c => c.id === selectedCertificationId
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

        // Close sheet first
        onOpenChange(false);

        // Call parent callback with real data
        onMaterialCreated(newMaterial);

        return result;
      })(),
      {
        delay: 200,
        successMessage: "Material created successfully",
      },
    ).catch((error) => {
      // toast.loading already handles error toast, but we can log for debugging
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
      // Upload file to certifications bucket
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const result = await uploadFile({
        file,
        path: ["certifications", `${timestamp}-${sanitizedFileName}`],
        bucket: "certifications",
      });

      setCertLogo(result.url);
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
    isNameValid && 
    (!certified || selectedCertificationId) && 
    !isUploading;

  // Get certification options for the select on certification page
  const certificationOptions = allCertifications.map((cert: Certification) => ({
    value: cert.id,
    label: cert.title,
  }));

  const handleCertificationSelectChange = (value: string): void => {
    const cert = allCertifications.find((c: Certification) => c.id === value);
    if (cert) {
      setCertTitle(cert.title);
      setCertCode(cert.code);
    }
  };

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
                              cert =>
                                cert.title
                                  .toLowerCase()
                                  .includes(certSearchTerm.toLowerCase()) ||
                                cert.certificationNumber
                                  .toLowerCase()
                                  .includes(certSearchTerm.toLowerCase())
                            )
                          : availableCertifications;

                        // Check if search term doesn't match any existing certification
                        const showCreateOption =
                          certSearchTerm &&
                          !availableCertifications.some(
                            cert =>
                              cert.title
                                .toLowerCase() ===
                                certSearchTerm.toLowerCase() ||
                              cert.certificationNumber
                                .toLowerCase() ===
                                certSearchTerm.toLowerCase()
                          );

                        return (
                          <>
                            {filteredCerts.length > 0 ? (
                              filteredCerts.map((cert) => (
                                <button
                                  key={cert.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedCertificationId(cert.id)
                                  }
                                  className={cn(
                                    "w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors border-b border-border last:border-b-0",
                                    selectedCertificationId === cert.id &&
                                      "bg-accent-blue",
                                  )}
                                >
                                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                    {selectedCertificationId === cert.id ? (
                                      <Icons.Check className="h-5 w-5 text-brand" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-secondary">
                                        {cert.code.substring(0, 2)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 text-left mr-auto">
                                    <p className="type-p !leading-[14px] text-primary font-medium">
                                      {cert.title}
                                    </p>
                                    {cert.certificationNumber && (
                                      <p className="type-small !leading-[14px] text-tertiary">
                                        {cert.certificationNumber}
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
                                  icon={<Icons.Plus />}
                                  iconPosition="left"
                                >
                                  Create certification
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
                                className="w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors border-t border-border"
                              >
                                <Icons.Plus className="h-4 w-4 text-tertiary" />
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
              {/* Certification Select */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-select">
                  Certification <span className="text-destructive">*</span>
                </Label>
                <Select
                  options={certificationOptions}
                  value={
                    certTitle
                      ? allCertifications.find((c) => c.title === certTitle)
                          ?.id || ""
                      : ""
                  }
                  onValueChange={handleCertificationSelectChange}
                  placeholder="Select certification"
                  searchable
                  searchPlaceholder="Search certification..."
                  inline
                />
              </div>

              {/* Certification Number */}
              <div className="space-y-1.5">
                <Label htmlFor="cert-number">
                  Certification number{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cert-number"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="ABC123"
                  className="h-9"
                />
              </div>

              {/* Testing Institute & Expiry Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cert-institute">Testing institute</Label>
                  <Input
                    id="cert-institute"
                    value={certInstitute}
                    onChange={(e) => setCertInstitute(e.target.value)}
                    placeholder="Eurofins"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cert-expiry">
                    Expiry date <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    value={certExpiry || null}
                    onChange={(date) => setCertExpiry(date || undefined)}
                    placeholder="31/01/2027"
                    inline
                  />
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-border my-1" />

              {/* Certificate Upload */}
              <div className="space-y-1.5">
                <Label>Certificate</Label>
                {uploadedFileName ? (
                  <div className="flex items-center gap-2 p-3 border border-border bg-background">
                    <Icons.Check className="h-4 w-4 text-brand shrink-0" />
                    <span className="flex-1 type-small text-primary truncate">
                      {uploadedFileName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCertLogo(undefined);
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
                disabled={
                  !certTitle.trim() || !certNumber.trim() || !certExpiry || !certLogo || isCreating
                }
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
