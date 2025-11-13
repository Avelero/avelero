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

export interface OperatorData {
  id: string;
  name: string;
  legalName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  countryCode?: string;
}

interface OperatorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onOperatorCreated: (operator: OperatorData) => void;
}

export function OperatorSheet({
  open,
  onOpenChange,
  initialName = "",
  onOperatorCreated,
}: OperatorSheetProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const [name, setName] = React.useState(initialName);
  const [legalName, setLegalName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  
  // Operators are facilities (production plants)
  const createOperatorMutation = useMutation(
    trpc.brand.facilities.create.mutationOptions(),
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

    setIsCreating(true);

    try {
      // Combine address lines into single address field
      const fullAddress = [addressLine1.trim(), addressLine2.trim()]
        .filter(Boolean)
        .join(", ");

      // Combine contact info (email + phone)
      const contactInfo = [email.trim(), phone.trim()]
        .filter(Boolean)
        .join(" | ");

      // Create operator via API (using facilities endpoint)
      const result = await createOperatorMutation.mutateAsync({
        display_name: name.trim(),
        legal_name: legalName.trim() || undefined,
        address: fullAddress || undefined,
        city: city.trim() || undefined,
        country_code: countryCode || undefined,
        contact: contactInfo || undefined,
      });

      // Extract ID from wrapped response
      const operatorId = result?.data?.id;
      if (!operatorId) {
        throw new Error('No operator ID returned from API');
      }

      // Refetch passportFormReferences query to ensure fresh data
      await queryClient.refetchQueries({
        queryKey: trpc.composite.passportFormReferences.queryKey(),
      });

      // Wait for refetch to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Build operator data with real ID for parent callback
      const newOperator: OperatorData = {
        id: operatorId,
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        countryCode: countryCode || undefined,
      };

      onOperatorCreated(newOperator);
      toast.success("Operator created successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create operator:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create operator. Please try again.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isNameValid = name.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        {/* Header */}
        <SheetBreadcrumbHeader
          pages={["Create operator"]}
          currentPageIndex={0}
          onClose={() => onOpenChange(false)}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex flex-col gap-3">
            {/* Name & Legal name (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="operator-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="operator-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Factory Name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="operator-legal-name">Legal name</Label>
                <Input
                  id="operator-legal-name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Factory Name Co., Ltd."
                  className="h-9"
                />
              </div>
            </div>

            {/* Operator email */}
            <div className="space-y-1.5">
              <Label htmlFor="operator-email">Operator email</Label>
              <Input
                id="operator-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                className="h-9"
              />
            </div>

            {/* Operator phone */}
            <div className="space-y-1.5">
              <Label htmlFor="operator-phone">Operator phone</Label>
              <Input
                id="operator-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(020) 123 45 67"
                className="h-9"
              />
            </div>

            {/* Separator line */}
            <div className="border-t border-border my-1" />

            {/* Address line 1 */}
            <div className="space-y-1.5">
              <Label htmlFor="operator-address-1">Address line 1</Label>
              <Input
                id="operator-address-1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street 123"
                className="h-9"
              />
            </div>

            {/* Address line 2 */}
            <div className="space-y-1.5">
              <Label htmlFor="operator-address-2">Address line 2</Label>
              <Input
                id="operator-address-2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Building A"
                className="h-9"
              />
            </div>

            {/* Country & City (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <CountrySelect
                id="operator-country"
                label="Country"
                placeholder="Select country"
                value={countryCode}
                onChange={(code) => setCountryCode(code)}
              />
              <div className="space-y-1.5">
                <Label htmlFor="operator-city">City</Label>
                <Input
                  id="operator-city"
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
                <Label htmlFor="operator-state">Province / state</Label>
                <Input
                  id="operator-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="North-Holland"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="operator-zip">Postal code / ZIP code</Label>
                <Input
                  id="operator-zip"
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
