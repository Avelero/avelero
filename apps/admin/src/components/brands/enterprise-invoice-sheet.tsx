"use client";

/**
 * Sheet-based enterprise invoice form for the platform-admin brand detail page.
 * Follows the same layout pattern as other app sheets (operator, manufacturer, etc.).
 */
import { CountrySelect } from "@/components/select/country-select";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import {
  Sheet,
  SheetBreadcrumbHeader,
  SheetContent,
  SheetFooter,
} from "@v1/ui/sheet";
import { useEffect, useMemo, useState } from "react";

interface EnterpriseInvoiceDefaults {
  recipientName: string;
  recipientEmail: string;
  recipientTaxId: string;
  recipientAddressLine1: string;
  recipientAddressLine2: string;
  recipientAddressCity: string;
  recipientAddressRegion: string;
  recipientAddressPostalCode: string;
  recipientAddressCountry: string;
  description: string;
  amountCents: string;
  servicePeriodStart: Date | null;
  dueDate: Date | null;
  footer: string;
  internalReference: string;
}

interface EnterpriseInvoicePayload {
  recipient_name: string;
  recipient_email: string;
  recipient_tax_id?: string;
  recipient_address_line_1?: string;
  recipient_address_line_2?: string;
  recipient_address_city?: string;
  recipient_address_region?: string;
  recipient_address_postal_code?: string;
  recipient_address_country?: string;
  description: string;
  amount_cents: number;
  service_period_start: string;
  due_date?: string;
  footer?: string;
  internal_reference?: string;
}

interface EnterpriseInvoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: EnterpriseInvoiceDefaults;
  isSubmitting: boolean;
  onSubmit: (payload: EnterpriseInvoicePayload) => void;
}

function toIsoDayStart(date: Date): string {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString();
}

function toIsoDayEnd(date: Date): string {
  const value = new Date(date);
  value.setUTCHours(23, 59, 59, 0);
  return value.toISOString();
}

export function EnterpriseInvoiceSheet({
  open,
  onOpenChange,
  defaults,
  isSubmitting,
  onSubmit,
}: EnterpriseInvoiceSheetProps) {
  const [recipientName, setRecipientName] = useState(defaults.recipientName);
  const [recipientEmail, setRecipientEmail] = useState(defaults.recipientEmail);
  const [recipientTaxId, setRecipientTaxId] = useState(defaults.recipientTaxId);
  const [recipientAddressLine1, setRecipientAddressLine1] = useState(
    defaults.recipientAddressLine1,
  );
  const [recipientAddressLine2, setRecipientAddressLine2] = useState(
    defaults.recipientAddressLine2,
  );
  const [recipientAddressCity, setRecipientAddressCity] = useState(
    defaults.recipientAddressCity,
  );
  const [recipientAddressRegion, setRecipientAddressRegion] = useState(
    defaults.recipientAddressRegion,
  );
  const [recipientAddressPostalCode, setRecipientAddressPostalCode] = useState(
    defaults.recipientAddressPostalCode,
  );
  const [recipientAddressCountry, setRecipientAddressCountry] = useState(
    defaults.recipientAddressCountry,
  );
  const [description, setDescription] = useState(defaults.description);
  const [amountCents, setAmountCents] = useState(defaults.amountCents);
  const [servicePeriodStart, setServicePeriodStart] = useState<Date | null>(
    defaults.servicePeriodStart,
  );
  const [dueDate, setDueDate] = useState<Date | null>(defaults.dueDate);
  const [footer, setFooter] = useState(defaults.footer);
  const [internalReference, setInternalReference] = useState(
    defaults.internalReference,
  );

  // Container ref for portal - ensures popovers render inside the sheet
  const [sheetContainer, setSheetContainer] =
    useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setRecipientName(defaults.recipientName);
    setRecipientEmail(defaults.recipientEmail);
    setRecipientTaxId(defaults.recipientTaxId);
    setRecipientAddressLine1(defaults.recipientAddressLine1);
    setRecipientAddressLine2(defaults.recipientAddressLine2);
    setRecipientAddressCity(defaults.recipientAddressCity);
    setRecipientAddressRegion(defaults.recipientAddressRegion);
    setRecipientAddressPostalCode(defaults.recipientAddressPostalCode);
    setRecipientAddressCountry(defaults.recipientAddressCountry);
    setDescription(defaults.description);
    setAmountCents(defaults.amountCents);
    setServicePeriodStart(defaults.servicePeriodStart);
    setDueDate(defaults.dueDate);
    setFooter(defaults.footer);
    setInternalReference(defaults.internalReference);
  }, [defaults, open]);

  const servicePeriodEnd = useMemo(() => {
    if (!servicePeriodStart) return null;
    const value = new Date(servicePeriodStart);
    value.setUTCFullYear(value.getUTCFullYear() + 1);
    return value;
  }, [servicePeriodStart]);

  const canSubmit =
    recipientName.trim().length > 0 &&
    recipientEmail.trim().length > 0 &&
    description.trim().length > 0 &&
    servicePeriodStart !== null &&
    amountCents.trim().length > 0 &&
    !Number.isNaN(Number.parseInt(amountCents, 10)) &&
    Number.parseInt(amountCents, 10) > 0;

  const handleSubmit = () => {
    const parsedAmount = Number.parseInt(amountCents, 10);

    if (!canSubmit || Number.isNaN(parsedAmount) || !servicePeriodStart) return;

    onSubmit({
      recipient_name: recipientName.trim(),
      recipient_email: recipientEmail.trim(),
      recipient_tax_id: recipientTaxId.trim() || undefined,
      recipient_address_line_1: recipientAddressLine1.trim() || undefined,
      recipient_address_line_2: recipientAddressLine2.trim() || undefined,
      recipient_address_city: recipientAddressCity.trim() || undefined,
      recipient_address_region: recipientAddressRegion.trim() || undefined,
      recipient_address_postal_code:
        recipientAddressPostalCode.trim() || undefined,
      recipient_address_country: recipientAddressCountry.trim() || undefined,
      description: description.trim(),
      amount_cents: parsedAmount,
      service_period_start: toIsoDayStart(servicePeriodStart),
      due_date: dueDate ? toIsoDayEnd(dueDate) : undefined,
      footer: footer.trim() || undefined,
      internal_reference: internalReference.trim() || undefined,
    });
  };

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
          pages={["Create invoice"]}
          currentPageIndex={0}
          onClose={() => onOpenChange(false)}
        />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <div className="flex flex-col gap-3">
            {/* Recipient */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-recipient-name">
                  Recipient name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-recipient-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Legal entity name"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-recipient-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-recipient-email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="billing@example.com"
                  type="email"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-tax-id">Tax ID</Label>
              <Input
                id="invoice-tax-id"
                value={recipientTaxId}
                onChange={(e) => setRecipientTaxId(e.target.value)}
                placeholder="Optional"
                className="h-9"
              />
            </div>

            {/* Separator */}
            <div className="border-t border-border my-1" />

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="invoice-address-1">Address line 1</Label>
              <Input
                id="invoice-address-1"
                value={recipientAddressLine1}
                onChange={(e) => setRecipientAddressLine1(e.target.value)}
                placeholder="Street and number"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-address-2">Address line 2</Label>
              <Input
                id="invoice-address-2"
                value={recipientAddressLine2}
                onChange={(e) => setRecipientAddressLine2(e.target.value)}
                placeholder="Optional"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CountrySelect
                id="invoice-country"
                label="Country"
                placeholder="Select country"
                value={recipientAddressCountry}
                onChange={(value) => setRecipientAddressCountry(value)}
                container={sheetContainer}
              />
              <div className="space-y-1.5">
                <Label htmlFor="invoice-city">City</Label>
                <Input
                  id="invoice-city"
                  value={recipientAddressCity}
                  onChange={(e) => setRecipientAddressCity(e.target.value)}
                  placeholder="Amsterdam"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invoice-region">Province / state</Label>
                <Input
                  id="invoice-region"
                  value={recipientAddressRegion}
                  onChange={(e) => setRecipientAddressRegion(e.target.value)}
                  placeholder="North-Holland"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invoice-postal-code">Postal code</Label>
                <Input
                  id="invoice-postal-code"
                  value={recipientAddressPostalCode}
                  onChange={(e) =>
                    setRecipientAddressPostalCode(e.target.value)
                  }
                  placeholder="1012AA"
                  className="h-9"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-border my-1" />

            {/* Invoice details */}
            <div className="space-y-1.5">
              <Label htmlFor="invoice-description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoice-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Avelero Enterprise"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-amount">
                Amount (cents) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoice-amount"
                value={amountCents}
                onChange={(e) => setAmountCents(e.target.value)}
                placeholder="e.g. 2000000"
                type="number"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Service period start{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={servicePeriodStart}
                  onChange={setServicePeriodStart}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Service period end</Label>
                <Input
                  value={
                    servicePeriodEnd
                      ? servicePeriodEnd.toLocaleDateString()
                      : "Set start date"
                  }
                  disabled
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Due date</Label>
              <DatePicker value={dueDate} onChange={setDueDate} />
            </div>

            {/* Separator */}
            <div className="border-t border-border my-1" />

            {/* Optional extras */}
            <div className="space-y-1.5">
              <Label htmlFor="invoice-reference">Internal reference</Label>
              <Input
                id="invoice-reference"
                value={internalReference}
                onChange={(e) => setInternalReference(e.target.value)}
                placeholder="Optional reference for Avelero"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-footer">Footer</Label>
              <Textarea
                id="invoice-footer"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Optional footer shown on the invoice"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter>
          <Button
            variant="outline"
            size="default"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-[70px]"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            size="default"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? "Creating..." : "Create invoice"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
