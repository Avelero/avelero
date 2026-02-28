"use client";

import { CountrySelect } from "@/components/select/country-select";
import { MainSkeleton } from "@/components/main-skeleton";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@v1/ui/table";
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
    <section className="border bg-background">
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b">
        <div>
          <h5 className="text-primary">{title}</h5>
          {subtitle ? <p className="type-small text-secondary mt-0.5">{subtitle}</p> : null}
        </div>
        {headerRight ? <div className="flex items-center gap-2 flex-shrink-0">{headerRight}</div> : null}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
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
            <span className={cn("truncate px-1", isPlaceholder ? "text-tertiary" : "")}>
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
                  {value === opt.value ? <Icons.Check className="h-4 w-4" /> : null}
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

const BILLING_MODE_OPTIONS: {
  value: "" | "stripe_checkout" | "stripe_invoice";
  label: string;
}[] = [
  { value: "", label: "No billing mode" },
  { value: "stripe_checkout", label: "Stripe Checkout" },
  { value: "stripe_invoice", label: "Stripe Invoice" },
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
  const [billingOverrideExpiresAt, setBillingOverrideExpiresAt] = useState<Date | null>(null);

  const [planType, setPlanType] = useState<"" | "starter" | "growth" | "scale" | "enterprise">("");
  const [billingMode, setBillingMode] = useState<"" | "stripe_checkout" | "stripe_invoice">("");
  const [skuAnnualLimit, setSkuAnnualLimit] = useState("");
  const [skuOnboardingLimit, setSkuOnboardingLimit] = useState("");
  const [skuLimitOverride, setSkuLimitOverride] = useState("");
  const [customMonthlyPriceCents, setCustomMonthlyPriceCents] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "member">("member");

  const [note, setNote] = useState("");

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
      (brandData.plan.plan_type as "" | "starter" | "growth" | "scale" | "enterprise") ?? "",
    );
    setBillingMode(
      (brandData.billing.billing_mode as "" | "stripe_checkout" | "stripe_invoice") ?? "",
    );
    setSkuAnnualLimit(
      brandData.plan.sku_annual_limit !== null
        ? String(brandData.plan.sku_annual_limit)
        : "",
    );
    setSkuOnboardingLimit(
      brandData.plan.sku_onboarding_limit !== null
        ? String(brandData.plan.sku_onboarding_limit)
        : "",
    );
    setSkuLimitOverride(
      brandData.plan.sku_limit_override !== null
        ? String(brandData.plan.sku_limit_override)
        : "",
    );
    setCustomMonthlyPriceCents(
      brandData.billing.custom_monthly_price_cents !== null
        ? String(brandData.billing.custom_monthly_price_cents)
        : "",
    );
  }, [brandData]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries();
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
      onError: (error) => toast.error(error.message || "Failed to suspend brand"),
    }),
  );

  const reactivateMutation = useMutation(
    trpc.platformAdmin.lifecycle.reactivate.mutationOptions({
      onSuccess: async () => {
        toast.success("Brand reactivated");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to reactivate brand"),
    }),
  );

  const cancelMutation = useMutation(
    trpc.platformAdmin.lifecycle.cancel.mutationOptions({
      onSuccess: async () => {
        toast.success("Brand cancelled");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to cancel brand"),
    }),
  );

  const updateBillingOverrideMutation = useMutation(
    trpc.platformAdmin.billing.setAccessOverride.mutationOptions({
      onSuccess: async () => {
        toast.success("Billing override updated");
        await refreshAll();
      },
      onError: (error) => toast.error(error.message || "Failed to update override"),
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
      onError: (error) => toast.error(error.message || "Failed to remove member"),
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
      onError: (error) => toast.error(error.message || "Failed to revoke invite"),
    }),
  );

  const checkoutStubMutation = useMutation(
    trpc.platformAdmin.billing.createCheckoutLink.mutationOptions({
      onSuccess: (result) => {
        toast.error(result.message);
      },
      onError: (error) => toast.error(error.message || "Action unavailable"),
    }),
  );

  const invoiceStubMutation = useMutation(
    trpc.platformAdmin.billing.createInvoice.mutationOptions({
      onSuccess: (result) => {
        toast.error(result.message);
      },
      onError: (error) => toast.error(error.message || "Action unavailable"),
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
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" />
        </FieldRow>
        <FieldRow label="Slug">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="brand-slug" />
        </FieldRow>
        <FieldRow label="Billing email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@example.com" />
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
              {updateBillingOverrideMutation.isPending ? "Saving…" : "Save Override"}
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
        <SimpleSelect
          label="Billing mode"
          value={billingMode}
          onChange={setBillingMode}
          options={BILLING_MODE_OPTIONS}
        />
        <FieldRow label="Custom monthly price (cents)">
          <Input
            type="number"
            placeholder="e.g. 4900"
            value={customMonthlyPriceCents}
            onChange={(e) => setCustomMonthlyPriceCents(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="SKU annual limit">
          <Input
            type="number"
            placeholder="Leave empty for no limit"
            value={skuAnnualLimit}
            onChange={(e) => setSkuAnnualLimit(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="SKU onboarding limit">
          <Input
            type="number"
            placeholder="Leave empty for no limit"
            value={skuOnboardingLimit}
            onChange={(e) => setSkuOnboardingLimit(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="SKU limit override">
          <Input
            type="number"
            placeholder="Leave empty for no override"
            value={skuLimitOverride}
            onChange={(e) => setSkuLimitOverride(e.target.value)}
          />
        </FieldRow>
        <p className="type-small text-secondary">
          Annual usage: {brandData.usage.annual.used}
          {brandData.usage.annual.limit !== null
            ? ` / ${brandData.usage.annual.limit}`
            : " (no limit)"}
        </p>
        <div className="pt-1">
          <Button
            onClick={() =>
              updatePlanMutation.mutate({
                brand_id: brandId,
                plan_type:
                  (planType || null) as
                    | "starter"
                    | "growth"
                    | "scale"
                    | "enterprise"
                    | null,
                billing_mode:
                  (billingMode || null) as "stripe_checkout" | "stripe_invoice" | null,
                custom_monthly_price_cents: parseIntOrNull(customMonthlyPriceCents),
                sku_annual_limit: parseIntOrNull(skuAnnualLimit),
                sku_onboarding_limit: parseIntOrNull(skuOnboardingLimit),
                sku_limit_override: parseIntOrNull(skuLimitOverride),
              })
            }
            disabled={updatePlanMutation.isPending}
          >
            {updatePlanMutation.isPending ? "Saving…" : "Save Plan"}
          </Button>
        </div>
      </Section>

      {/* ── Billing ───────────────────────────────────────────────── */}
      <Section title="Billing">
        <div className="space-y-1">
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">Stripe customer:</span>{" "}
            {brandData.billing.stripe_customer_id ?? "Not linked"}
          </p>
          <p className="type-small text-secondary">
            <span className="text-primary font-medium">Stripe subscription:</span>{" "}
            {brandData.billing.stripe_subscription_id ?? "Not linked"}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkoutStubMutation.mutate({ brand_id: brandId })}
            disabled={checkoutStubMutation.isPending}
          >
            Create Checkout Session
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => invoiceStubMutation.mutate({ brand_id: brandId })}
            disabled={invoiceStubMutation.isPending}
          >
            Create Invoice
          </Button>
        </div>

        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Stripe Event</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brandData.billing.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-secondary type-small py-6">
                    No billing events.
                  </TableCell>
                </TableRow>
              ) : (
                brandData.billing.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.event_type}</TableCell>
                    <TableCell>{event.stripe_event_id ?? "-"}</TableCell>
                    <TableCell>{formatDate(event.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>

      {/* ── Members ───────────────────────────────────────────────── */}
      <Section title="Members">
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-secondary type-small py-6">
                    No members.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell>{member.email ?? "-"}</TableCell>
                    <TableCell>{member.full_name ?? "-"}</TableCell>
                    <TableCell>
                      <span className="inline-flex border px-2 py-1 type-small bg-accent-light text-primary">
                        {member.role}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(member.joined_at)}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>

      {/* ── Invites ───────────────────────────────────────────────── */}
      <Section title="Invites">
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
        <div className="pt-1">
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

        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-secondary type-small py-6">
                    No pending invites.
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>{invite.role}</TableCell>
                    <TableCell>{formatDate(invite.created_at)}</TableCell>
                    <TableCell>{formatDate(invite.expires_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeInviteMutation.mutate({ invite_id: invite.id })}
                        disabled={revokeInviteMutation.isPending}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>

      {/* ── Audit Log ─────────────────────────────────────────────── */}
      <Section title="Audit Log">
        <FieldRow label="Internal notes">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Local only, not persisted"
            className="min-h-[96px]"
          />
        </FieldRow>

        <div className="border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-secondary type-small py-6">
                    No audit log entries.
                  </TableCell>
                </TableRow>
              ) : (
                audits.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>
                      {entry.actor_full_name ?? entry.actor_email ?? "Unknown"}
                    </TableCell>
                    <TableCell>{formatDate(entry.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>
    </div>
  );
}
