"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import {
  type ValidationErrors,
  type ValidationSchema,
  getFirstInvalidField,
  isFormValid,
  rules,
  validateForm,
} from "@/hooks/use-form-validation";
import { useTRPC } from "@/trpc/client";
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

export interface ManufacturerData {
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

interface ManufacturerFormValues {
  name: string;
  email: string;
  phone: string;
  website: string;
}

interface ManufacturerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialManufacturer?: ManufacturerData;
  onManufacturerCreated?: (manufacturer: ManufacturerData) => void;
  onSave?: (manufacturer: ManufacturerData) => void | Promise<void>;
}

export function ManufacturerSheet({
  open,
  onOpenChange,
  initialName = "",
  initialManufacturer,
  onManufacturerCreated,
  onSave,
}: ManufacturerSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { manufacturers: existingManufacturers } = useBrandCatalog();

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

  const [fieldErrors, setFieldErrors] = React.useState<
    ValidationErrors<ManufacturerFormValues>
  >({});

  // Container ref for portal - ensures popovers render inside the sheet
  const [sheetContainer, setSheetContainer] =
    React.useState<HTMLDivElement | null>(null);

  // API mutation for creating manufacturer
  const createManufacturerMutation = useMutation(
    trpc.catalog.manufacturers.create.mutationOptions(),
  );
  const updateManufacturerMutation = useMutation(
    trpc.catalog.manufacturers.update.mutationOptions(),
  );
  const isEditMode = !!initialManufacturer;

  const validationSchema = React.useMemo<
    ValidationSchema<ManufacturerFormValues>
  >(
    () => ({
      name: [
        rules.required("Manufacturer name is required"),
        rules.maxLength(100, "Name must be 100 characters or less"),
        rules.uniqueCaseInsensitive(
          existingManufacturers
            .filter(
              (manufacturer: { id?: string; name: string }) =>
                manufacturer.id !== initialManufacturer?.id,
            )
            .map((manufacturer: { name: string }) => manufacturer.name),
          "A manufacturer with this name already exists",
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
    [existingManufacturers, initialManufacturer?.id],
  );

  const clearFieldError = React.useCallback(
    (field: keyof ManufacturerFormValues) => {
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
    (field: keyof ManufacturerFormValues, value: string) => {
      const values: ManufacturerFormValues = {
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

  // Prefill fields when opening (supports both create and edit modes).
  React.useEffect(() => {
    if (open) {
      setName(initialManufacturer?.name ?? initialName);
      setLegalName(initialManufacturer?.legalName ?? "");
      setEmail(initialManufacturer?.email ?? "");
      setPhone(initialManufacturer?.phone ?? "");
      setWebsite(initialManufacturer?.website ?? "");
      setAddressLine1(initialManufacturer?.addressLine1 ?? "");
      setAddressLine2(initialManufacturer?.addressLine2 ?? "");
      setCity(initialManufacturer?.city ?? "");
      setState(initialManufacturer?.state ?? "");
      setZip(initialManufacturer?.zip ?? "");
      setCountryCode(initialManufacturer?.countryCode ?? "");
      setFieldErrors({});
    }
  }, [open, initialManufacturer, initialName]);

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
    const formValues: ManufacturerFormValues = {
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
        document.getElementById("manufacturer-name")?.focus();
      } else if (firstInvalidField === "email") {
        document.getElementById("manufacturer-email")?.focus();
      } else if (firstInvalidField === "phone") {
        document.getElementById("manufacturer-phone")?.focus();
      } else if (firstInvalidField === "website") {
        document.getElementById("manufacturer-website")?.focus();
      }
      return;
    }

    const normalizedWebsite = website.trim() ? normalizeUrl(website) : "";
    const formattedPhone = phone.trim() ? formatPhone(phone.trim()) : "";

    try {
      // Execute mutation with toast.loading to handle loading/success/error states
      const mutationResult = await toast.loading(
        isEditMode ? "Saving manufacturer..." : "Creating manufacturer...",
        (async () => {
          const payload = {
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
          };

          if (isEditMode) {
            return updateManufacturerMutation.mutateAsync({
              id: initialManufacturer.id,
              name: payload.name,
              legal_name: legalName.trim() || null,
              email: email.trim() || null,
              phone: formattedPhone || null,
              website: normalizedWebsite || null,
              address_line_1: addressLine1.trim() || null,
              address_line_2: addressLine2.trim() || null,
              city: city.trim() || null,
              state: state.trim() || null,
              zip: zip.trim() || null,
              country_code: countryCode || null,
            });
          }

          return createManufacturerMutation.mutateAsync(payload);
        })(),
        {
          delay: 500,
          successMessage: isEditMode
            ? "Manufacturer saved successfully"
            : "Manufacturer created successfully",
        },
      );

      const createdManufacturer = mutationResult?.data;

      if (!createdManufacturer?.id) {
        throw new Error("No valid response returned from API");
      }

      const manufacturerId = createdManufacturer.id;
      const now = new Date().toISOString();
      const manufacturerData: ManufacturerData = {
        id: manufacturerId,
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        email: email.trim() || undefined,
        phone: formattedPhone || undefined,
        website: normalizedWebsite || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        countryCode: countryCode || undefined,
      };

      // Optimistically update the cache immediately
      queryClient.setQueryData(
        trpc.composite.catalogContent.queryKey(),
        (old: any) => {
          if (!old) return old;
          const nextManufacturer = {
            id: manufacturerId,
            name: manufacturerData.name,
            legal_name: manufacturerData.legalName ?? null,
            email: manufacturerData.email ?? null,
            phone: manufacturerData.phone ?? null,
            website: manufacturerData.website ?? null,
            address_line_1: manufacturerData.addressLine1 ?? null,
            address_line_2: manufacturerData.addressLine2 ?? null,
            city: manufacturerData.city ?? null,
            state: manufacturerData.state ?? null,
            zip: manufacturerData.zip ?? null,
            country_code: manufacturerData.countryCode ?? null,
            created_at:
              (old.brandCatalog?.manufacturers ?? []).find(
                (m: any) => m.id === manufacturerId,
              )?.created_at ?? now,
            updated_at: now,
          };

          const existing = old.brandCatalog.manufacturers ?? [];
          const nextManufacturers = isEditMode
            ? existing.map((manufacturer: any) =>
                manufacturer.id === manufacturerId ? nextManufacturer : manufacturer,
              )
            : [...existing, nextManufacturer];

          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              manufacturers: nextManufacturers,
            },
          };
        },
      );

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.catalogContent.queryKey(),
      });

      setFieldErrors({});
      if (isEditMode) {
        await onSave?.(manufacturerData);
      } else {
        onManufacturerCreated?.(manufacturerData);
        await onSave?.(manufacturerData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save manufacturer:", error);

      // Parse error for specific messages
      let errorMessage = "Failed to save manufacturer. Please try again.";

      if (error instanceof Error) {
        if (
          error.message.includes("unique constraint") ||
          error.message.includes("duplicate")
        ) {
          errorMessage = "A manufacturer with this name already exists.";
        } else if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
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
  const isSaving =
    createManufacturerMutation.isPending || updateManufacturerMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={setSheetContainer}
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        {/* Header */}
        <SheetBreadcrumbHeader
          pages={[isEditMode ? "Edit manufacturer" : "Create manufacturer"]}
          currentPageIndex={0}
          onClose={() => onOpenChange(false)}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex flex-col gap-3">
            {/* Name & Legal name (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manufacturer-name"
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
                <Label htmlFor="manufacturer-legal-name">Legal name</Label>
                <Input
                  id="manufacturer-legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Manufacturer Name Inc."
                  className="h-9"
                  maxLength={100}
                />
              </div>
            </div>

            {/* Public email */}
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer-email">Public email</Label>
              <Input
                id="manufacturer-email"
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
              <Label htmlFor="manufacturer-phone">Public phone</Label>
              <Input
                id="manufacturer-phone"
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
              <Label htmlFor="manufacturer-website">Website</Label>
              <Input
                id="manufacturer-website"
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
                <p className="text-xs text-destructive">
                  {fieldErrors.website}
                </p>
              )}
            </div>

            {/* Separator line */}
            <div className="border-t border-border my-1" />

            {/* Address line 1 */}
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer-address-1">Address line 1</Label>
              <Input
                id="manufacturer-address-1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Funenpark"
                className="h-9"
                maxLength={500}
              />
            </div>

            {/* Address line 2 */}
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer-address-2">Address line 2</Label>
              <Input
                id="manufacturer-address-2"
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
                id="manufacturer-country"
                label="Country"
                placeholder="Select country"
                value={countryCode}
                onChange={(code) => setCountryCode(code)}
                container={sheetContainer}
              />
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer-city">City</Label>
                <Input
                  id="manufacturer-city"
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
                <Label htmlFor="manufacturer-state">Province / state</Label>
                <Input
                  id="manufacturer-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="North-Holland"
                  className="h-9"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer-zip">Postal code / ZIP code</Label>
                <Input
                  id="manufacturer-zip"
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
            disabled={isSaving}
            className="min-w-[70px]"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            size="default"
            onClick={handleCreate}
            disabled={!isNameValid || isSaving}
            className="min-w-[70px]"
          >
            {isEditMode ? "Save" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
