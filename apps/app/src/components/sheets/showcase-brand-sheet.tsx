"use client";

import { useTRPC } from "@/trpc/client";
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

  // API mutation for creating showcase brand
  const createBrandMutation = useMutation(
    trpc.brand.showcaseBrands.create.mutationOptions(),
  );

  // Update name when initialName changes (when sheet opens with pre-filled name)
  React.useEffect(() => {
    if (open && initialName) {
      setName(initialName);
    }
  }, [open, initialName]);

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
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
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      // Call API to create showcase brand immediately
      const result = await createBrandMutation.mutateAsync({
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
      });

      const createdBrand = result?.data;
      if (!createdBrand?.id) {
        throw new Error("No valid response returned from API");
      }

      // Refetch passportFormReferences query to ensure fresh data
      await queryClient.refetchQueries({
        queryKey: trpc.composite.passportFormReferences.queryKey(),
      });

      // Wait for refetch to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

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

      // Call parent callback with real data
      onBrandCreated(brandData);

      // Show success message
      toast.success("Brand created successfully");

      // Close sheet
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create brand:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create brand. Please try again.",
      );
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isNameValid = name.trim().length > 0;
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Avelero Apparel"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-legal-name">Legal name</Label>
                <Input
                  id="brand-legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Brand Name Inc."
                  className="h-9"
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="help@example.com"
                className="h-9"
              />
            </div>

            {/* Public phone */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-phone">Public phone</Label>
              <Input
                id="brand-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(020) 123 45 67"
                className="h-9"
              />
            </div>

            {/* Website */}
            <div className="space-y-1.5">
              <Label htmlFor="brand-website">Website</Label>
              <Input
                id="brand-website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="example.com"
                className="h-9"
              />
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
                placeholder="Street 123"
                className="h-9"
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
            className="w-[70px]"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            size="default"
            onClick={handleCreate}
            disabled={!isNameValid || isCreating}
            className="w-[70px]"
          >
            Create
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
