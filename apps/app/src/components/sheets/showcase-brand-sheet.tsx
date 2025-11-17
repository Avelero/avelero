"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { useTRPC } from "@/trpc/client";
import {
  getFirstInvalidField,
  isFormValid,
  rules,
  type ValidationErrors,
  type ValidationSchema,
  validateForm,
} from "@/hooks/use-form-validation";
import { formatPhone, normalizeUrl } from "@/utils/validation";
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

interface ShowcaseBrandFormValues {
  name: string;
  email: string;
  phone: string;
  website: string;
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
  const { showcaseBrands: existingBrands } = useBrandCatalog();

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

  const [fieldErrors, setFieldErrors] =
    React.useState<ValidationErrors<ShowcaseBrandFormValues>>({});

  // API mutation for creating showcase brand
  const createBrandMutation = useMutation(
    trpc.brand.showcaseBrands.create.mutationOptions(),
  );

  const validationSchema = React.useMemo<ValidationSchema<ShowcaseBrandFormValues>>(
    () => ({
      name: [
        rules.required("Brand name is required"),
        rules.maxLength(100, "Name must be 100 characters or less"),
        rules.uniqueCaseInsensitive(
          existingBrands.map((brand) => brand.name),
          "A brand with this name already exists",
        ),
      ],
      email: [
        rules.maxLength(100, "Email must be 100 characters or less"),
        rules.email(),
      ],
      phone: [
        rules.maxLength(100, "Phone must be 100 characters or less"),
        rules.phone(),
      ],
      website: [
        rules.maxLength(100, "Website must be 100 characters or less"),
        rules.url(),
      ],
    }),
    [existingBrands],
  );

  const clearFieldError = React.useCallback(
    (field: keyof ShowcaseBrandFormValues) => {
      setFieldErrors((prev) => {
        if (!prev[field]) {
          return prev;
        }
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const validateSingleField = React.useCallback(
    (field: keyof ShowcaseBrandFormValues, value: string) => {
      const values: ShowcaseBrandFormValues = {
        name,
        email,
        phone,
        website,
      };
      values[field] = value;
      const errors = validateForm(values, validationSchema);
      setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
    },
    [name, email, phone, website, validationSchema],
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
        setFieldErrors({});
      }, 350); // Wait for sheet close animation
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleCreate = async () => {
    const formValues: ShowcaseBrandFormValues = {
      name,
      email,
      phone,
      website,
    };
    const validationErrors = validateForm(formValues, validationSchema);
    setFieldErrors(validationErrors);

    if (!isFormValid(validationErrors)) {
      const firstInvalidField = getFirstInvalidField(validationErrors, [
        "name",
        "email",
        "phone",
        "website",
      ]);
      if (firstInvalidField === "name") {
        document.getElementById("brand-name")?.focus();
      } else if (firstInvalidField === "email") {
        document.getElementById("brand-email")?.focus();
      } else if (firstInvalidField === "phone") {
        document.getElementById("brand-phone")?.focus();
      } else if (firstInvalidField === "website") {
        document.getElementById("brand-website")?.focus();
      }
      return;
    }

    const normalizedWebsite = website.trim() ? normalizeUrl(website) : "";
    const formattedPhone = phone.trim() ? formatPhone(phone.trim()) : "";

    try {
      // Execute mutation with toast.loading to handle loading/success/error states
      const mutationResult = await toast.loading(
        "Creating brand...",
        createBrandMutation.mutateAsync({
          name: name.trim(),
          legal_name: legalName.trim() || undefined,
          email: email.trim() || undefined,
          phone: formattedPhone || undefined,
          website: normalizedWebsite || undefined,
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
      setFieldErrors({});
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

  const isNameValid = name.trim().length > 0 && !fieldErrors.name;
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
                    clearFieldError("name");
                  }}
                  onBlur={() => validateSingleField("name", name)}
                  placeholder="Avelero Apparel"
                  className="h-9"
                  maxLength={100}
                  aria-required="true"
                  required
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
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
                  if (fieldErrors.email) {
                    clearFieldError("email");
                  }
                }}
                onBlur={() => {
                  if (email.trim()) {
                    validateSingleField("email", email);
                  } else {
                    clearFieldError("email");
                  }
                }}
                placeholder="help@example.com"
                className="h-9"
                maxLength={100}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
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
                  if (fieldErrors.phone) {
                    clearFieldError("phone");
                  }
                }}
                onBlur={() => {
                  if (phone.trim()) {
                    validateSingleField("phone", phone);
                    setPhone(formatPhone(phone.trim()));
                  } else {
                    clearFieldError("phone");
                  }
                }}
                placeholder="+31 20 123 4567"
                className="h-9"
                maxLength={100}
              />
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
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
                  if (fieldErrors.website) {
                    clearFieldError("website");
                  }
                }}
                onBlur={() => {
                  if (website.trim()) {
                    const normalized = normalizeUrl(website);
                    if (normalized) {
                      setWebsite(normalized);
                      validateSingleField("website", normalized);
                    } else {
                      setFieldErrors((prev) => ({
                        ...prev,
                        website: "Please enter a valid URL",
                      }));
                    }
                  } else {
                    clearFieldError("website");
                  }
                }}
                placeholder="https://example.com"
                className="h-9"
                maxLength={100}
              />
              {fieldErrors.website && (
                <p className="text-xs text-destructive">{fieldErrors.website}</p>
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
