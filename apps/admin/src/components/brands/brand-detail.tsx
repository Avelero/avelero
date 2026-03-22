"use client";

import { CountrySelect } from "@/components/select/country-select";
import { MainSkeleton } from "@/components/main-skeleton";
import { EnterpriseInvoiceSheet } from "@/components/brands/enterprise-invoice-sheet";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import { Icons } from "@v1/ui/icons";
import { Textarea } from "@v1/ui/textarea";
import { toast } from "@v1/ui/sonner";
import { cn } from "@v1/ui/cn";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface BrandDetailProps {
  brandId: string;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function toIsoDayEnd(date: Date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 0);
  return d.toISOString();
}

function parseIntOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMoneyCents(value: number, currency: string) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value / 100);
}

// ─── Reusable field layout helpers ───────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Section({
  title,
  subtitle,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-background">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="type-p !font-medium text-primary">{title}</p>
            {subtitle ? (
              <p className="type-small text-secondary mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          {headerRight ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerRight}
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function SimpleSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "Select…";
  const isPlaceholder = !selected;

  return (
    <div className={label ? "space-y-1.5" : undefined}>
      {label ? <Label>{label}</Label> : null}
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger asChild>
          <Button
            variant="outline"
            size="default"
            className="w-full justify-between data-[state=open]:bg-accent"
          >
            <span
              className={cn(
                "truncate px-1",
                isPlaceholder ? "text-tertiary" : "",
              )}
            >
              {displayLabel}
            </span>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </SelectTrigger>
        <SelectContent shouldFilter={false}>
          <SelectList>
            <SelectGroup>
              {options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="px-1">{opt.label}</span>
                  {value === opt.value ? (
                    <Icons.Check className="h-4 w-4" />
                  ) : null}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectList>
        </SelectContent>
      </Select>
    </div>
  );
}

const BILLING_OVERRIDE_OPTIONS: {
  value: "none" | "temporary_allow" | "temporary_block";
  label: string;
}[] = [
  { value: "none", label: "No billing override" },
  { value: "temporary_allow", label: "Temporary allow" },
  { value: "temporary_block", label: "Temporary block" },
];

const PLAN_TYPE_OPTIONS: {
  value: "" | "starter" | "growth" | "scale" | "enterprise";
  label: string;
}[] = [
  { value: "", label: "No plan" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "scale", label: "Scale" },
  { value: "enterprise", label: "Enterprise" },
];

const BILLING_INTERVAL_OPTIONS: {
  value: "" | "quarterly" | "yearly";
  label: string;
}[] = [
  { value: "", label: "No interval" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const INVITE_ROLE_OPTIONS: { value: "member" | "owner"; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "owner", label: "Owner" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function BrandDetail({ brandId }: BrandDetailProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const brandQuery = useQuery(
    trpc.platformAdmin.brands.get.queryOptions({ brand_id: brandId }),
  );
  const membersQuery = useQuery(
    trpc.platformAdmin.members.list.queryOptions({ brand_id: brandId }),
  );
  const invitesQuery = useQuery(
    trpc.platformAdmin.invites.list.queryOptions({ brand_id: brandId }),
  );
  const auditQuery = useQuery(
    trpc.platformAdmin.audit.list.queryOptions({
      brand_id: brandId,
      page: 1,
      page_size: 20,
    }),
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("");

  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [billingOverride, setBillingOverride] = useState<
    "none" | "temporary_allow" | "temporary_block"
  >("none");
  const [billingOverrideExpiresAt, setBillingOverrideExpiresAt] =
    useState<Date | null>(null);

  const [planType, setPlanType] = useState<
    "" | "starter" | "growth" | "scale" | "enterprise"
  >("");
  const [billingInterval, setBillingInterval] = useState<
    "" | "quarterly" | "yearly"
  >("");
  const [customPriceCents, setCustomPriceCents] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "member">("member");

  const [note, setNote] = useState("");

  const [invoiceSheetOpen, setInvoiceSheetOpen] = useState(false);

  const loading =
    brandQuery.isLoading || membersQuery.isLoading || invitesQuery.isLoading;

  const brandData = brandQuery.data;
  const members = membersQuery.data?.items ?? [];
  const invites = invitesQuery.data?.items ?? [];
  const audits = auditQuery.data?.items ?? [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  useEffect(() => {
    if (!brandData) return;

    setName(brandData.brand.name ?? "");
    setSlug(brandData.brand.slug ?? "");
    setEmail(brandData.brand.email ?? "");
    setCountryCode(brandData.brand.country_code ?? "");

    setTrialEndsAt(
      brandData.lifecycle.trial_ends_at
        ? new Date(brandData.lifecycle.trial_ends_at)
        : null,
    );

    const override = brandData.billing.billing_access_override;
    setBillingOverride(
      override === "temporary_allow" || override === "temporary_block"
        ? override
        : "none",
    );
    setBillingOverrideExpiresAt(
      brandData.billing.billing_override_expires_at
        ? new Date(brandData.billing.billing_override_expires_at)
        : null,
    );

    setPlanType(
      (brandData.plan.plan_type as
        | ""
        | "starter"
        | "growth"
        | "scale"
        | "enterprise") ?? "",
    );
    setBillingInterval(
      (brandData.plan.billing_interval as "" | "quarterly" | "yearly") ?? "",
    );
    setCustomPriceCents(
      brandData.billing.custom_price_cents !== null
        ? String(brandData.billing.custom_price_cents)
        : "",
    );
  }, [brandData]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.platformAdmin.brands.get.queryKey({ brand_id: brandId }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.platformAdmin.brands.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.platformAdmin.members.list.queryKey({
          brand_id: brandId,
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.platformAdmin.invites.list.queryKey({
          brand_id: brandId,
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.platformAdmin.audit.list.queryKey({
          brand_id: brandId,
          page: 1,
          page_size: 20,
        }),
      }),
    ]);
  };

  const updateIdentityMutation = useMutation(
    trpc.platformAdmin.brands.updateIdentity.mutationOptions({
      onSuccess: async () => {
        toast.success("Brand updated");
        await refreshAll();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update brand");
      },
    }),
  );

  const extendTrialMutation = useMutation(
    trpc.platformAdmin.lifecycle.extendTrial.mutationOptions({
      onSuccess: async () => {
        toast.success("Trial updated");
        await refreshAll();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to extend trial");
      },
    }),
  );

  const suspendMutation = useMutation(
    trpc.platformAdmin.lifecycle.suspend.mutationOptions({
      onSuccess: async () => {
        toast.success("Brand suspended");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to suspend brand"),
    }),
  );

  const reactivateMutation = useMutation(
    trpc.platformAdmin.lifecycle.reactivate.mutationOptions({
      onSuccess: async () => {
        toast.success("Brand reactivated");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to reactivate brand"),
    }),
  );

  const cancelMutation = useMutation(
    trpc.platformAdmin.lifecycle.cancel.mutationOptions({
      onSuccess: async () => {
        toast.success("Brand cancelled");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to cancel brand"),
    }),
  );

  const updateBillingOverrideMutation = useMutation(
    trpc.platformAdmin.billing.setAccessOverride.mutationOptions({
      onSuccess: async () => {
        toast.success("Billing override updated");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to update override"),
    }),
  );

  const updatePlanMutation = useMutation(
    trpc.platformAdmin.plan.update.mutationOptions({
      onSuccess: async () => {
        toast.success("Plan updated");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to update plan"),
    }),
  );

  const addSelfMutation = useMutation(
    trpc.platformAdmin.members.addSelf.mutationOptions({
      onSuccess: async () => {
        toast.success("Added yourself to brand");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to add self"),
    }),
  );

  const removeSelfMutation = useMutation(
    trpc.platformAdmin.members.removeSelf.mutationOptions({
      onSuccess: async () => {
        toast.success("Removed yourself from brand");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to remove self"),
    }),
  );

  const removeMemberMutation = useMutation(
    trpc.platformAdmin.members.remove.mutationOptions({
      onSuccess: async () => {
        toast.success("Member removed");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to remove member"),
    }),
  );

  const sendInviteMutation = useMutation(
    trpc.platformAdmin.invites.send.mutationOptions({
      onSuccess: async () => {
        toast.success("Invite sent");
        setInviteEmail("");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to send invite"),
    }),
  );

  const revokeInviteMutation = useMutation(
    trpc.platformAdmin.invites.revoke.mutationOptions({
      onSuccess: async () => {
        toast.success("Invite revoked");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to revoke invite"),
    }),
  );

  const createInvoiceMutation = useMutation(
    trpc.platformAdmin.billing.createInvoice.mutationOptions({
      onSuccess: async (result) => {
        if (result.invoice_url) {
          await navigator.clipboard.writeText(result.invoice_url);
          toast.success(`Invoice created and link copied: ${result.invoice_id}`);
        } else {
          toast.success(`Invoice created: ${result.invoice_id}`);
        }

        setInvoiceSheetOpen(false);
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to create invoice"),
    }),
  );

  const resendInvoiceMutation = useMutation(
    trpc.platformAdmin.billing.resendInvoice.mutationOptions({
      onSuccess: async () => {
        toast.success("Invoice email sent");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to resend invoice"),
    }),
  );

  const voidInvoiceMutation = useMutation(
    trpc.platformAdmin.billing.voidInvoice.mutationOptions({
      onSuccess: async () => {
        toast.success("Invoice voided");
        await refreshAll();
      },
      onError: (error) =>
        toast.error(error.message || "Failed to void invoice"),
    }),
  );

  const statusMessage = useMemo(() => {
    if (!brandData) return "";
    return `${brandData.lifecycle.phase} (changed ${formatDate(
      brandData.lifecycle.phase_changed_at,
    )})`;
  }, [brandData]);

  if (loading) {
    return <MainSkeleton contained className="h-full min-h-[360px]" />;
  }

  if (!brandData) {
    return (
      <div className="border p-6 bg-background">
        <p className="text-secondary">Brand not found.</p>
      </div>
    );
  }

  const canCreateInvoice = brandData.billing.billing_mode === "stripe_invoice";
  const derivedBillingModeLabel =
    planType === "enterprise"
      ? "Stripe Invoice"
      : planType
        ? "Stripe Checkout"
        : "No billing mode";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Title ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex items-center text-secondary hover:text-primary transition-colors"
          prefetch
        >
          <Icons.ChevronLeft className="h-5 w-5" />
        </Link>
        <h4 className="text-primary">{brandData.brand.name}</h4>
      </div>

      {/* ── Overview ─────────────────────────────────────────────── */}
      <Section
        title="Overview"
        subtitle={statusMessage}
        headerRight={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addSelfMutation.mutate({ brand_id: brandId })}
              disabled={addSelfMutation.isPending}
            >
              Add Self
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeSelfMutation.mutate({ brand_id: brandId })}
              disabled={removeSelfMutation.isPending}
            >
              Remove Self
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!appUrl) return;
                window.open(`${appUrl}/`, "_blank", "noopener,noreferrer");
              }}
              disabled={!appUrl}
            >
              Open in App
            </Button>
          </>
        }
      >
        <FieldRow label="Brand name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Brand name"
          />
        </FieldRow>
        <FieldRow label="Slug">
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="brand-slug"
          />
        </FieldRow>
        <FieldRow label="Billing email">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="billing@example.com"
          />
        </FieldRow>
        <CountrySelect
          id="country_code"
          label="Country"
          placeholder="Select country"
          value={countryCode}
          onChange={(code) => setCountryCode(code)}
        />
        <div className="pt-1">
          <Button
            onClick={() =>
              updateIdentityMutation.mutate({
                brand_id: brandId,
                name: name.trim(),
                slug: slug.trim(),
                email: email.trim() || null,
                country_code: countryCode.trim() || null,
              })
            }
            disabled={updateIdentityMutation.isPending}
          >
            {updateIdentityMutation.isPending ? "Saving…" : "Save Overview"}
          </Button>
        </div>
      </Section>

      {/* ── Lifecycle Management ──────────────────────────────────── */}
      <Section title="Lifecycle Management">
        <FieldRow label="Trial end date">
          <DatePicker value={trialEndsAt} onChange={setTrialEndsAt} />
        </FieldRow>
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!trialEndsAt) return;
              extendTrialMutation.mutate({
                brand_id: brandId,
                trial_ends_at: toIsoDayEnd(trialEndsAt),
              });
            }}
            disabled={extendTrialMutation.isPending || !trialEndsAt}
          >
            {extendTrialMutation.isPending ? "Saving…" : "Extend Trial"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => suspendMutation.mutate({ brand_id: brandId })}
            disabled={suspendMutation.isPending}
          >
            {suspendMutation.isPending ? "Suspending…" : "Suspend"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactivateMutation.mutate({ brand_id: brandId })}
            disabled={reactivateMutation.isPending}
          >
            {reactivateMutation.isPending ? "Reactivating…" : "Reactivate"}
          </Button>
        </div>

        <div className="border-t pt-4 space-y-4">
          <SimpleSelect
            label="Billing override"
            value={billingOverride}
            onChange={setBillingOverride}
            options={BILLING_OVERRIDE_OPTIONS}
          />
          <FieldRow label="Override expiration date">
            <DatePicker
              value={billingOverrideExpiresAt}
              onChange={setBillingOverrideExpiresAt}
              disabled={billingOverride === "none"}
            />
          </FieldRow>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateBillingOverrideMutation.mutate({
                  brand_id: brandId,
                  override: billingOverride,
                  expires_at:
                    billingOverride === "none" || !billingOverrideExpiresAt
                      ? null
                      : toIsoDayEnd(billingOverrideExpiresAt),
                })
              }
              disabled={updateBillingOverrideMutation.isPending}
            >
              {updateBillingOverrideMutation.isPending
                ? "Saving…"
                : "Save Override"}
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cancelMutation.mutate({ brand_id: brandId })}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel Brand"}
          </Button>
        </div>
      </Section>

      {/* ── Plan & Limits ─────────────────────────────────────────── */}
      <Section title="Plan & Limits">
        <SimpleSelect
          label="Plan"
          value={planType}
          onChange={setPlanType}
          options={PLAN_TYPE_OPTIONS}
        />
        <p className="type-small text-secondary">
          Billing mode is determined by the selected plan:{" "}
          <span className="text-primary">{derivedBillingModeLabel}</span>
        </p>
        <SimpleSelect
          label="Billing interval"
          value={planType === "enterprise" ? "yearly" : billingInterval}
          onChange={setBillingInterval}
          options={BILLING_INTERVAL_OPTIONS}
        />
        <FieldRow
          label={
            planType === "enterprise"
              ? "Custom yearly price (cents)"
              : "Custom price (cents)"
          }
        >
          <Input
            type="number"
            placeholder="e.g. 4900"
            value={customPriceCents}
            onChange={(e) => setCustomPriceCents(e.target.value)}
          />
        </FieldRow>
        {planType === "enterprise" ? (
          <p className="type-small text-secondary">
            Enterprise billing is yearly-only. The service period anchor is set
            the first time the enterprise plan is saved.
          </p>
        ) : null}
        <p className="type-small text-secondary">
          Credits: {brandData.usage.credits.published}
          {` / ${brandData.usage.credits.total}`} published, with{" "}
          {brandData.usage.credits.remaining} remaining.
        </p>
        <p className="type-small text-secondary">
          Onboarding discount used:{" "}
          {brandData.plan.onboarding_discount_used ? "Yes" : "No"}
        </p>
        <div className="pt-1">
          <Button
            onClick={() =>
              updatePlanMutation.mutate({
                brand_id: brandId,
                plan_type: (planType || null) as
                  | "starter"
                  | "growth"
                  | "scale"
                  | "enterprise"
                  | null,
                billing_interval: (
                  (planType === "enterprise" ? "yearly" : billingInterval) ||
                  null
                ) as "quarterly" | "yearly" | null,
                custom_price_cents: parseIntOrNull(customPriceCents),
              })
            }
            disabled={updatePlanMutation.isPending}
          >
            {updatePlanMutation.isPending ? "Saving…" : "Save Plan"}
          </Button>
        </div>
      </Section>

      {/* ── Billing ───────────────────────────────────────────────── */}
      <Section
        title="Billing"
        subtitle="Stripe-linked billing state for this brand."
        headerRight={
          canCreateInvoice ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInvoiceSheetOpen(true)}
              disabled={createInvoiceMutation.isPending}
              className="whitespace-nowrap"
            >
              {createInvoiceMutation.isPending ? "Creating…" : "New invoice"}
            </Button>
          ) : null
        }
      >
        {!canCreateInvoice ? (
          <p className="type-small text-secondary">
            Set billing mode to{" "}
            <span className="text-primary">Stripe Invoice</span> under Plan &
            Limits to create enterprise invoices.
          </p>
        ) : null}

        <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">Customer:</span>{" "}
            {brandData.billing.stripe_customer_id ?? "Not linked"}
          </p>
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">Subscription:</span>{" "}
            {brandData.billing.stripe_subscription_id ?? "Not linked"}
          </p>
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">Period:</span>{" "}
            {brandData.billing.current_period_start
              ? `${formatDate(brandData.billing.current_period_start)} → ${formatDate(brandData.billing.current_period_end)}`
              : "Not set"}
          </p>
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">Past due since:</span>{" "}
            {formatDate(brandData.billing.past_due_since)}
          </p>
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">
              Pending cancellation:
            </span>{" "}
            {brandData.billing.pending_cancellation ? "Yes" : "No"}
          </p>
        </div>

        {/* Billing contact defaults */}
        <div className="border-t border-border pt-3 mt-1 space-y-1">
          <p className="type-small font-medium text-primary">
            Billing contact
          </p>
          <p className="type-small text-secondary">
            {brandData.billing.billing_legal_name || "No billing name saved"}
          </p>
          <p className="type-small text-secondary">
            {brandData.billing.billing_email || "No billing email saved"}
          </p>
          <p className="type-small text-secondary">
            {[
              brandData.billing.billing_address_line_1,
              brandData.billing.billing_address_line_2,
              brandData.billing.billing_address_postal_code,
              brandData.billing.billing_address_city,
              brandData.billing.billing_address_region,
              brandData.billing.billing_address_country,
            ]
              .filter(Boolean)
              .join(", ") || "No billing address saved"}
          </p>
        </div>
      </Section>

      {/* ── Invoices ──────────────────────────────────────────────── */}
      <section className="border border-border bg-background">
        <div className="p-4">
          <p className="type-p !font-medium text-primary">Invoices</p>
        </div>
        {brandData.billing.invoices.length === 0 ? (
          <div className="flex items-center justify-center h-[120px] border-t border-border">
            <p className="type-p text-tertiary">No invoices yet</p>
          </div>
        ) : (
          brandData.billing.invoices.map((invoice, index, items) => {
            const isLast = index === items.length - 1;
            const invoiceLabel =
              invoice.invoice_number ?? invoice.stripe_invoice_id;
            const statusLabel = invoice.status.replaceAll("_", " ");

            return (
              <div
                key={invoice.stripe_invoice_id}
                className={cn(
                  "px-4 py-3 border-t border-border",
                  isLast && "border-b-0",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="type-p text-primary truncate">
                      {invoiceLabel}
                    </p>
                    <p className="type-small text-secondary capitalize">
                      {statusLabel}
                    </p>
                  </div>
                  <p className="type-p text-primary whitespace-nowrap">
                    {formatMoneyCents(invoice.amount_due, invoice.currency)}
                  </p>
                </div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <p className="type-small text-secondary">
                    <span className="text-primary font-medium">Period:</span>{" "}
                    {invoice.service_period_start
                      ? `${formatDate(invoice.service_period_start)} → ${formatDate(invoice.service_period_end)}`
                      : "-"}
                  </p>
                  <p className="type-small text-secondary">
                    <span className="text-primary font-medium">Due:</span>{" "}
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {invoice.hosted_invoice_url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const hostedInvoiceUrl = invoice.hosted_invoice_url;
                          if (!hostedInvoiceUrl) return;

                          await navigator.clipboard.writeText(hostedInvoiceUrl);
                          toast.success("Invoice link copied");
                        }}
                      >
                        Copy Link
                      </Button>
                    ) : null}
                    {invoice.hosted_invoice_url ? (
                      <Button
                        size="sm"
                        variant="outline"
                      onClick={() => {
                        const hostedInvoiceUrl = invoice.hosted_invoice_url;
                        if (!hostedInvoiceUrl) return;
                        window.open(
                          hostedInvoiceUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                    >
                      Open
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resendInvoiceMutation.mutate({
                        brand_id: brandId,
                        invoice_id: invoice.stripe_invoice_id,
                      })
                    }
                    disabled={
                      resendInvoiceMutation.isPending ||
                      invoice.status !== "open"
                    }
                  >
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      voidInvoiceMutation.mutate({
                        brand_id: brandId,
                        invoice_id: invoice.stripe_invoice_id,
                      })
                    }
                    disabled={
                      voidInvoiceMutation.isPending ||
                      !["draft", "open"].includes(invoice.status)
                    }
                  >
                    Void
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── Billing Events ────────────────────────────────────────── */}
      <section className="border border-border bg-background">
        <div className="p-4">
          <p className="type-p !font-medium text-primary">Billing Events</p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_160px] border-t border-border">
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-r border-border">
            Event
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-r border-border">
            Stripe Event
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary">
            Created
          </div>
        </div>
        {brandData.billing.events.length === 0 ? (
          <div className="flex items-center justify-center h-[120px]">
            <p className="type-p text-tertiary">No billing events</p>
          </div>
        ) : (
          brandData.billing.events.map((event, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <div
                key={event.id}
                className="grid grid-cols-[1fr_1fr_160px] border-t border-border"
              >
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                  )}
                >
                  {event.event_type}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                  )}
                >
                  {event.stripe_event_id ?? "-"}
                </div>
                <div className="px-4 py-2.5 type-p text-primary">
                  {formatDate(event.created_at)}
                </div>
              </div>
            );
          })
        )}
      </section>

      <EnterpriseInvoiceSheet
        open={invoiceSheetOpen}
        onOpenChange={setInvoiceSheetOpen}
        defaults={{
          recipientName:
            brandData.billing.billing_legal_name || brandData.brand.name || "",
          recipientEmail:
            brandData.billing.billing_email || brandData.brand.email || "",
          recipientTaxId: brandData.billing.billing_tax_id || "",
          recipientAddressLine1: brandData.billing.billing_address_line_1 || "",
          recipientAddressLine2: brandData.billing.billing_address_line_2 || "",
          recipientAddressCity: brandData.billing.billing_address_city || "",
          recipientAddressRegion: brandData.billing.billing_address_region || "",
          recipientAddressPostalCode:
            brandData.billing.billing_address_postal_code || "",
          recipientAddressCountry:
            brandData.billing.billing_address_country ||
            brandData.brand.country_code ||
            "",
          description: "Avelero Enterprise",
          amountCents:
            brandData.billing.custom_price_cents !== null
              ? String(brandData.billing.custom_price_cents)
              : "",
          servicePeriodStart: brandData.billing.current_period_start
            ? new Date(brandData.billing.current_period_start)
            : new Date(),
          dueDate: null,
          footer: "",
          internalReference: "",
        }}
        isSubmitting={createInvoiceMutation.isPending}
        onSubmit={(payload) =>
          createInvoiceMutation.mutate({
            brand_id: brandId,
            ...payload,
          })
        }
      />

      {/* ── Members ───────────────────────────────────────────────── */}
      <section className="border border-border bg-background">
        <div className="p-4">
          <p className="type-p !font-medium text-primary">Members</p>
        </div>
        <div className="grid grid-cols-[1fr_1fr_100px_160px_100px]">
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Email
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Name
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Role
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Joined
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
            Actions
          </div>
        </div>
        {members.length === 0 ? (
          <div className="flex items-center justify-center h-[120px]">
            <p className="type-p text-tertiary">No members</p>
          </div>
        ) : (
          members.map((member, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <div
                key={member.user_id}
                className="grid grid-cols-[1fr_1fr_100px_160px_100px]"
              >
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary truncate",
                    !isLast && "border-b",
                  )}
                >
                  {member.email ?? "-"}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {member.full_name ?? "-"}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5",
                    !isLast && "border-b",
                  )}
                >
                  <span className="inline-flex border px-2 py-0.5 type-small bg-accent-light text-primary">
                    {member.role}
                  </span>
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {formatDate(member.joined_at)}
                </div>
                <div
                  className={cn(
                    "border-border px-3 py-2 flex items-center",
                    !isLast && "border-b",
                  )}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      removeMemberMutation.mutate({
                        brand_id: brandId,
                        user_id: member.user_id,
                      })
                    }
                    disabled={removeMemberMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── Invites ───────────────────────────────────────────────── */}
      <section className="border border-border bg-background">
        <div className="p-4 flex flex-col gap-3">
          <p className="type-p !font-medium text-primary">Invites</p>
          <FieldRow label="Email">
            <Input
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </FieldRow>
          <SimpleSelect
            label="Role"
            value={inviteRole}
            onChange={setInviteRole}
            options={INVITE_ROLE_OPTIONS}
          />
          <div>
            <Button
              onClick={() =>
                sendInviteMutation.mutate({
                  brand_id: brandId,
                  email: inviteEmail.trim().toLowerCase(),
                  role: inviteRole,
                })
              }
              disabled={sendInviteMutation.isPending || !inviteEmail.trim()}
            >
              {sendInviteMutation.isPending ? "Sending…" : "Send Invite"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_100px_160px_160px_100px]">
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Email
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Role
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Sent
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Expires
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
            Actions
          </div>
        </div>
        {invites.length === 0 ? (
          <div className="flex items-center justify-center h-[120px]">
            <p className="type-p text-tertiary">No pending invites</p>
          </div>
        ) : (
          invites.map((invite, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <div
                key={invite.id}
                className="grid grid-cols-[1fr_100px_160px_160px_100px]"
              >
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary truncate",
                    !isLast && "border-b",
                  )}
                >
                  {invite.email}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {invite.role}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {formatDate(invite.created_at)}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {formatDate(invite.expires_at)}
                </div>
                <div
                  className={cn(
                    "border-border px-3 py-2 flex items-center",
                    !isLast && "border-b",
                  )}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      revokeInviteMutation.mutate({ invite_id: invite.id })
                    }
                    disabled={revokeInviteMutation.isPending}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── Audit Log ─────────────────────────────────────────────── */}
      <section className="border border-border bg-background">
        <div className="p-4 flex flex-col gap-3">
          <p className="type-p !font-medium text-primary">Audit Log</p>
          <FieldRow label="Internal notes">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Local only, not persisted"
              className="min-h-[96px]"
            />
          </FieldRow>
        </div>
        <div className="grid grid-cols-[1fr_1fr_160px]">
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Action
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-r border-border">
            Actor
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
            Created
          </div>
        </div>
        {audits.length === 0 ? (
          <div className="flex items-center justify-center h-[120px]">
            <p className="type-p text-tertiary">No audit log entries</p>
          </div>
        ) : (
          audits.map((entry, i, arr) => {
            const isLast = i === arr.length - 1;
            return (
              <div key={entry.id} className="grid grid-cols-[1fr_1fr_160px]">
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {entry.action}
                </div>
                <div
                  className={cn(
                    "border-r border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {entry.actor_full_name ?? entry.actor_email ?? "Unknown"}
                </div>
                <div
                  className={cn(
                    "border-border px-4 py-2.5 type-p text-primary",
                    !isLast && "border-b",
                  )}
                >
                  {formatDate(entry.created_at)}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
