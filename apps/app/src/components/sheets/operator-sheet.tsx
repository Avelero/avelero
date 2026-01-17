"use client";

import { useTRPC } from "@/trpc/client";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import {
  getFirstInvalidField,
  isFormValid,
  rules,
  type ValidationErrors,
  type ValidationSchema,
  validateForm,
} from "@/hooks/use-form-validation";
import { formatPhone } from "@/utils/validation";
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

interface OperatorFormValues {
  name: string;
  email: string;
  phone: string;
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
  const { operators: existingOperators } = useBrandCatalog();

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

  // Validation error states
  const [fieldErrors, setFieldErrors] = React.useState<
    ValidationErrors<OperatorFormValues>
  >({});

  // Container ref for portal - ensures popovers render inside the sheet
  const [sheetContainer, setSheetContainer] =
    React.useState<HTMLDivElement | null>(null);

  // Operators are production plants in the supply chain
  const createOperatorMutation = useMutation(
    trpc.catalog.operators.create.mutationOptions(),
  );

  const validationSchema = React.useMemo<ValidationSchema<OperatorFormValues>>(
    () => ({
      name: [
        rules.required("Operator name is required"),
        rules.maxLength(100, "Name must be 100 characters or less"),
        rules.uniqueCaseInsensitive(
          existingOperators.map((operator) => operator.display_name),
          "An operator with this name already exists",
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
    }),
    [existingOperators],
  );

  const clearFieldError = React.useCallback(
    (field: keyof OperatorFormValues) => {
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
    (field: keyof OperatorFormValues, value: string) => {
      const values: OperatorFormValues = {
        name,
        email,
        phone,
      };
      values[field] = value;
      const errors = validateForm(values, validationSchema);
      setFieldErrors((prev) => ({ ...prev, [field]: errors[field] }));
    },
    [name, email, phone, validationSchema],
  );

  // Compute loading state from mutation
  const isCreating = createOperatorMutation.isPending;

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
    const formValues: OperatorFormValues = { name, email, phone };
    const validationErrors = validateForm(formValues, validationSchema);
    setFieldErrors(validationErrors);

    if (!isFormValid(validationErrors)) {
      const firstInvalidField = getFirstInvalidField(validationErrors, [
        "name",
        "email",
        "phone",
      ]);
      if (firstInvalidField === "name") {
        document.getElementById("operator-name")?.focus();
      } else if (firstInvalidField === "email") {
        document.getElementById("operator-email")?.focus();
      } else if (firstInvalidField === "phone") {
        document.getElementById("operator-phone")?.focus();
      }
      return;
    }

    const formattedPhone = phone.trim() ? formatPhone(phone.trim()) : "";

    try {
      // Show loading toast and execute mutation
      const mutationResult = await toast.loading(
        "Creating operator...",
        (async () => {
          // Combine address lines into single address field
          // Create operator via API
          const result = await createOperatorMutation.mutateAsync({
            display_name: name.trim(),
            legal_name: legalName.trim() || undefined,
            email: email.trim() || undefined,
            phone: formattedPhone || undefined,
            address_line_1: addressLine1.trim() || undefined,
            address_line_2: addressLine2.trim() || undefined,
            city: city.trim() || undefined,
            state: state.trim() || undefined,
            zip: zip.trim() || undefined,
            country_code: countryCode || undefined,
          });

          // Validate response
          const createdOperator = result?.data;
          if (!createdOperator?.id) {
            throw new Error("No valid response returned from API");
          }

          const operatorId = createdOperator.id;
          const now = new Date().toISOString();

          // Optimistically update the cache immediately
          queryClient.setQueryData(
            trpc.composite.catalogContent.queryKey(),
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                brandCatalog: {
                  ...old.brandCatalog,
                  operators: [
                    ...old.brandCatalog.operators,
                    {
                      id: operatorId,
                      display_name: name.trim(),
                      legal_name: legalName.trim() || null,
                      email: email.trim() || null,
                      phone: formattedPhone || null,
                      address_line_1: addressLine1.trim() || null,
                      address_line_2: addressLine2.trim() || null,
                      city: city.trim() || null,
                      state: state.trim() || null,
                      zip: zip.trim() || null,
                      country_code: countryCode || null,
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
            queryKey: trpc.composite.catalogContent.queryKey(),
          });

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

          // Call parent callback with real data
          onOperatorCreated(newOperator);

          // Close sheet first
          setFieldErrors({});
          onOpenChange(false);

          return result;
        })(),
        {
          delay: 500,
          successMessage: "Operator created successfully",
        },
      );
    } catch (error) {
      console.error("Failed to create operator:", error);

      // Parse error for specific messages
      let errorMessage = "Failed to create operator. Please try again.";

      if (error instanceof Error) {
        if (
          error.message.includes("unique constraint") ||
          error.message.includes("duplicate")
        ) {
          errorMessage = "An operator with this name already exists.";
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
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  onBlur={() => validateSingleField("name", name)}
                  placeholder="Factory Name"
                  className="h-9"
                  aria-required="true"
                  required
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                )}
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
                placeholder="contact@example.com"
                className="h-9"
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            {/* Operator phone */}
            <div className="space-y-1.5">
              <Label htmlFor="operator-phone">Operator phone</Label>
              <Input
                id="operator-phone"
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
                placeholder="(020) 123 45 67"
                className="h-9"
              />
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
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
                container={sheetContainer}
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
