"use client";

import * as React from "react";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Sheet, SheetContent, SheetBreadcrumbHeader, SheetFooter } from "@v1/ui/sheet";
import { Switch } from "@v1/ui/switch";
import { Icons } from "@v1/ui/icons";
import { DatePicker } from "@v1/ui/date-picker";
import { Select } from "@v1/ui/select";
import { cn } from "@v1/ui/cn";
import { BooleanToggle } from "@v1/ui/boolean";
import { CountrySelect } from "../select/country-select";
import type { Certification } from "@v1/selections/certifications";
import { allCertifications } from "@v1/selections/certifications";

interface MaterialData {
  id: string;
  name: string;
  countryOfOrigin?: string;
  recyclable?: boolean;
  certificationId?: string;
  certification?: CertificationData;
}

interface CertificationData {
  id: string;
  title: string;
  code: string;
  certificationNumber: string;
  instituteName: string;
  expiryDate?: Date;
  logo?: string;
}

interface MaterialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onMaterialCreated: (material: MaterialData) => void;
}

type Page = "material" | "certification";

/**
 * Renders a right-side sheet UI to create a material and optionally attach or create a certification.
 *
 * The sheet contains two pages: a "material" form (name, origin, recyclable flag, certification selection)
 * and a "certification" form (select existing certification, certification number, institute, expiry, and file upload).
 * Creating a certification stores it in local state and can be attached to the created material. Closing the sheet
 * resets all form state.
 *
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback invoked with the new open state when the sheet should be opened or closed
 * @param initialName - Optional initial material name prefilled when the sheet opens
 * @param onMaterialCreated - Callback invoked with the assembled MaterialData when the material is created
 * @returns The MaterialSheet React element
 */
export function MaterialSheet({
  open,
  onOpenChange,
  initialName = "",
  onMaterialCreated,
}: MaterialSheetProps) {
  const [currentPage, setCurrentPage] = React.useState<Page>("material");
  
  // Material form state
  const [name, setName] = React.useState(initialName);
  const [countryOfOrigin, setCountryOfOrigin] = React.useState("");
  const [recyclable, setRecyclable] = React.useState<boolean | undefined>(undefined);
  const [certified, setCertified] = React.useState(false);
  const [selectedCertificationId, setSelectedCertificationId] = React.useState<string | null>(null);
  const [certificationData, setCertificationData] = React.useState<CertificationData | null>(null);
  
  // Certification form state
  const [certTitle, setCertTitle] = React.useState("");
  const [certCode, setCertCode] = React.useState("");
  const [certNumber, setCertNumber] = React.useState("");
  const [certInstitute, setCertInstitute] = React.useState("");
  const [certExpiry, setCertExpiry] = React.useState<Date | undefined>(undefined);
  
  // File upload state
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update name when initialName changes (when sheet opens with pre-filled name)
  React.useEffect(() => {
    if (open && initialName) {
      setName(initialName);
    }
  }, [open, initialName]);

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      setCurrentPage("material");
      setName("");
      setCountryOfOrigin("");
      setRecyclable(undefined);
      setCertified(false);
      setSelectedCertificationId(null);
      setCertificationData(null);
      setCertTitle("");
      setCertCode("");
      setCertNumber("");
      setCertInstitute("");
      setCertExpiry(undefined);
    }
  }, [open]);

  const handleCreateCertification = () => {
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

  const handleCertificationCreate = () => {
    if (!certTitle.trim() || !certNumber.trim()) {
      return;
    }

    // Create certification data
    const newCert: CertificationData = {
      id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: certTitle.trim(),
      code: certCode.trim(),
      certificationNumber: certNumber.trim(),
      instituteName: certInstitute.trim(),
      expiryDate: certExpiry,
    };

    // Set as selected certification
    setCertificationData(newCert);
    setSelectedCertificationId(newCert.id);

    // Navigate back to material page
    handleBackToMaterial();
  };

  const handleMaterialCreate = () => {
    if (!name.trim()) {
      return;
    }

    // Generate material
    const newMaterial: MaterialData = {
      id: `material-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      countryOfOrigin: countryOfOrigin || undefined,
      recyclable,
      certificationId: selectedCertificationId || undefined,
      certification: certificationData || undefined,
    };

    onMaterialCreated(newMaterial);
    onOpenChange(false);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Handle file upload here
      console.log('File dropped:', files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Handle file upload here
      console.log('File selected:', files[0]);
    }
  };

  const isNameValid = name.trim().length > 0;

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
                    <p className="type-p !font-medium text-primary">Certified</p>
                    <p className="type-small text-tertiary">
                      Add a certification to this material, a copy of the certificate is
                      required. You'll receive an email 30 days before the expiry date.
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
                    {/* Certification List - Only shows user-created certifications */}
                    <div className="border border-border bg-background overflow-hidden max-h-[280px] overflow-y-auto">
                      {certificationData ? (
                        <button
                          type="button"
                          onClick={() => setSelectedCertificationId(certificationData.id)}
                          className={cn(
                            "w-full p-3 flex items-center gap-3 hover:bg-accent transition-colors border-b border-border last:border-b-0",
                            selectedCertificationId === certificationData.id && "bg-accent-blue"
                          )}
                        >
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {selectedCertificationId === certificationData.id ? (
                              <Icons.Check className="h-5 w-5 text-brand" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-secondary">
                                {certificationData.code.substring(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="type-p !leading-[14px] text-primary font-medium">
                              {certificationData.title}
                            </p>
                            <p className="type-small !leading-[14px] text-tertiary">
                              {certificationData.certificationNumber}
                            </p>
                          </div>
                          {certificationData.expiryDate && (
                            <div className="text-right">
                              <p className="type-small !leading-[14px] text-tertiary">
                                Expires on {certificationData.expiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                          <p className="type-p text-tertiary text-center mb-3">
                            No certifications yet
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCreateCertification}
                            icon={<Icons.Plus />}
                            iconPosition="left"
                          >
                            Create certification
                          </Button>
                        </div>
                      )}
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
                  value={certTitle ? allCertifications.find(c => c.title === certTitle)?.id || "" : ""}
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
                  Certification number <span className="text-destructive">*</span>
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
                    placeholder="31-01-2027"
                    inline
                  />
                </div>
              </div>

            {/* Separator */}
            <div className="border-t border-border my-1" />

              {/* Certificate Upload */}
              <div className="space-y-1.5">
                <Label>Certificate</Label>
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
                  )}
                >
                  <p className="type-small text-tertiary mb-1">
                    Drop your certificate here, or click to browse.
                  </p>
                  <p className="type-small text-tertiary">4MB file limit.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter>
          <div className="flex items-center justify-end gap-3">
            {currentPage === "material" ? (
              <>
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => onOpenChange(false)}
                  className="w-[70px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="brand"
                  size="default"
                  onClick={handleMaterialCreate}
                  disabled={!isNameValid}
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
                  className="w-[70px]"
                >
                  Back
                </Button>
                <Button
                  variant="brand"
                  size="default"
                  onClick={handleCertificationCreate}
                  disabled={!certTitle.trim() || !certNumber.trim()}
                  className="w-[70px]"
                >
                  Create
                </Button>
              </>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
