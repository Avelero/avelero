"use client";

import { usePassportFormData } from "@/hooks/use-passport-form-data";
import { useTRPC } from "@/trpc/client";
import {
  formatPhone,
  isValidEmail,
  isValidUrl,
  normalizeUrl,
  validatePhone,
} from "@/utils/validation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
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

export interface ShowcaseBrandData {
  id: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  countryCode?: string;
}

interface ShowcaseBrandSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onBrandCreated: (brand: ShowcaseBrandData) => void;
}

export function ShowcaseBrandSheet({
  open,
  onOpenChange,
  initialName = "",
  onBrandCreated,
}: ShowcaseBrandSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showcaseBrands: existingBrands } = usePassportFormData();

  const [name, setName] = React.useState(initialName);
  const [legalName, setLegalName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("");

  // Validation error states
  const [nameError, setNameError] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [phoneError, setPhoneError] = React.useState("");
  const [websiteError, setWebsiteError] = React.useState("");

  // API mutation for creating showcase brand
  const createBrandMutation = useMutation(
    trpc.brand.showcaseBrands.create.mutationOptions(),
  );

  // Update name when initialName changes (when sheet opens with pre-filled name)
  React.useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  // Reset form when sheet closes (delayed to avoid flash during animation)
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setName("");
        setLegalName("");
        setEmail("");
        setPhone("");
        setWebsite("");
        setAddressLine1("");
        setAddressLine2("");
        setCity("");
        setState("");
        setZip("");
        setCountryCode("");
        setNameError("");
        setEmailError("");
        setPhoneError("");
        setWebsiteError("");
      }, 350); // Wait for sheet close animation
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Validation functions
  const validateName = (value: string): boolean => {
    const trimmedName = value.trim();
    
    if (!trimmedName) {
      setNameError("Brand name is required");
      return false;
    }

    const isDuplicate = existingBrands.some(
      (brand) => brand.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (isDuplicate) {
      setNameError("A brand with this name already exists");
      return false;
    }

    setNameError("");
    return true;
  };

  const handleCreate = async () => {
    // Validate all fields before submission
    const isNameValid = validateName(name);
    
    const isEmailValid = email.trim() ? isValidEmail(email) : true;
    if (!isEmailValid) setEmailError("Please enter a valid email address");
    
    const phoneResult = validatePhone(phone);
    const isPhoneValid = phoneResult.isValid;
    if (!isPhoneValid && phone.trim()) setPhoneError(phoneResult.error || "Invalid phone number");
    
    const isWebsiteValid = isValidUrl(website);
    if (!isWebsiteValid && website.trim()) setWebsiteError("Please enter a valid URL");

    if (!isNameValid || !isEmailValid || !isPhoneValid || !isWebsiteValid) {
      // Focus the first invalid field
      if (!isNameValid) {
        document.getElementById("brand-name")?.focus();
      } else if (!isEmailValid) {
        document.getElementById("brand-email")?.focus();
      } else if (!isPhoneValid) {
        document.getElementById("brand-phone")?.focus();
      } else if (!isWebsiteValid) {
        document.getElementById("brand-website")?.focus();
      }
      return;
    }

    try {
      // Show loading toast and execute mutation
      const mutationResult = await toast.loading(
        "Creating brand...",
        createBrandMutation.mutateAsync({
          name: name.trim(),
          legal_name: legalName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          address_line_1: addressLine1.trim() || undefined,
          address_line_2: addressLine2.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
          country_code: countryCode || undefined,
        }),
        {
          delay: 200,
          successMessage: "Brand created successfully",
        },
      );

      const createdBrand = mutationResult?.data;

      if (!createdBrand?.id) {
        throw new Error("No valid response returned from API");
      }

      // Optimistically update the cache immediately
      queryClient.setQueryData(
        trpc.composite.passportFormReferences.queryKey(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              showcaseBrands: [
                ...old.brandCatalog.showcaseBrands,
                {
                  id: createdBrand.id,
                  name: createdBrand.name,
                  legal_name: createdBrand.legal_name,
                  email: createdBrand.email,
                  phone: createdBrand.phone,
                  website: createdBrand.website,
                  address_line_1: createdBrand.address_line_1,
                  address_line_2: createdBrand.address_line_2,
                  city: createdBrand.city,
                  state: createdBrand.state,
                  zip: createdBrand.zip,
                  country_code: createdBrand.country_code,
                  created_at: createdBrand.created_at,
                  updated_at: createdBrand.updated_at,
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

      // Transform API response to component format
      const brandData: ShowcaseBrandData = {
        id: createdBrand.id,
        name: createdBrand.name,
        legalName: createdBrand.legal_name || undefined,
        email: createdBrand.email || undefined,
        phone: createdBrand.phone || undefined,
        website: createdBrand.website || undefined,
        addressLine1: createdBrand.address_line_1 || undefined,
        addressLine2: createdBrand.address_line_2 || undefined,
        city: createdBrand.city || undefined,
        state: createdBrand.state || undefined,
        zip: createdBrand.zip || undefined,
        countryCode: createdBrand.country_code || undefined,
      };

      // Close sheet first
      onOpenChange(false);

      // Call parent callback with real data
      onBrandCreated(brandData);
    } catch (error) {
      console.error("Failed to create brand:", error);
      
      // Parse error for specific messages
      let errorMessage = "Failed to create brand. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("unique constraint") || 
            error.message.includes("duplicate")) {
          errorMessage = "A brand with this name already exists.";
        } else if (error.message.includes("network") || 
                   error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection.";
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isNameValid = name.trim().length > 0 && !nameError;
  const isCreating = createBrandMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        {/* Header */}
        <SheetBreadcrumbHeader
          pages={["Create brand"]}
          currentPageIndex={0}
          onClose={() => onOpenChange(false)}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex flex-col gap-3">
            {/* Name & Legal name (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="brand-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) validateName(e.target.value);
                  }}
                  onBlur={() => validateName(name)}
                  placeholder="Avelero Apparel"
                  className="h-9"
                  maxLength={100}
                  aria-required="true"
                  required
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-legal-name">Legal name</Label>
                <Input
                  id="brand-legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Brand Name Inc."
                  className="h-9"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Public email */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-email">Public email</Label>
              <Input
                id="brand-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError && e.target.value.trim()) {
                    setEmailError(isValidEmail(e.target.value) ? "" : "Please enter a valid email address");
                  }
                }}
                onBlur={() => {
                  if (email.trim()) {
                    setEmailError(isValidEmail(email) ? "" : "Please enter a valid email address");
                  } else {
                    setEmailError("");
                  }
                }}
                placeholder="help@example.com"
                className="h-9"
                maxLength={100}
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>

            {/* Public phone */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-phone">Public phone</Label>
              <Input
                id="brand-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError && e.target.value.trim()) {
                    const result = validatePhone(e.target.value);
                    setPhoneError(result.isValid ? "" : result.error || "Invalid phone number");
                  }
                }}
                onBlur={() => {
                  if (phone.trim()) {
                    const result = validatePhone(phone);
                    if (result.isValid) {
                      setPhone(formatPhone(phone));
                      setPhoneError("");
                    } else {
                      setPhoneError(result.error || "Invalid phone number");
                    }
                  } else {
                    setPhoneError("");
                  }
                }}
                placeholder="+31 20 123 4567"
                className="h-9"
                maxLength={100}
              />
              {phoneError && (
                <p className="text-xs text-destructive">{phoneError}</p>
              )}
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-website">Website</Label>
              <Input
                id="brand-website"
                type="text"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  if (websiteError && e.target.value.trim()) {
                    setWebsiteError(isValidUrl(e.target.value) ? "" : "Please enter a valid URL");
                  }
                }}
                onBlur={() => {
                  if (website.trim()) {
                    const normalized = normalizeUrl(website);
                    if (normalized) {
                      setWebsite(normalized);
                      setWebsiteError("");
                    } else {
                      setWebsiteError("Please enter a valid URL");
                    }
                  } else {
                    setWebsiteError("");
                  }
                }}
                placeholder="https://example.com"
                className="h-9"
                maxLength={100}
              />
              {websiteError && (
                <p className="text-xs text-destructive">{websiteError}</p>
              )}
            </div>

            {/* Separator line */}
            <div className="border-t border-border my-1" />

            {/* Address line 1 */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-address-1">Address line 1</Label>
              <Input
                id="brand-address-1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Funenpark"
                className="h-9"
                maxLength={500}
              />
            </div>

            {/* Address line 2 */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-address-2">Address line 2</Label>
              <Input
                id="brand-address-2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Building A"
                className="h-9"
                maxLength={500}
              />
            </div>

            {/* Country & City (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <CountrySelect
                id="brand-country"
                label="Country"
                placeholder="Select country"
                value={countryCode}
                onChange={(code) => setCountryCode(code)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="brand-city">City</Label>
                <Input
                  id="brand-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Amsterdam"
                  className="h-9"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Province/state & Postal code (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand-state">Province / state</Label>
                <Input
                  id="brand-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="North-Holland"
                  className="h-9"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-zip">Postal code / ZIP code</Label>
                <Input
                  id="brand-zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="1012AA"
                  className="h-9"
                  maxLength={100}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter>
          <Button
            variant="outline"
            size="default"
            onClick={handleCancel}
            disabled={isCreating}
            className="min-w-[70px]"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            size="default"
            onClick={handleCreate}
            disabled={!isNameValid || isCreating}
            className="min-w-[70px]"
          >
            Create
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
