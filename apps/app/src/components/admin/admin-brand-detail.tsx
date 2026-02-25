"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { toast } from "@v1/ui/sonner";
import { useEffect, useMemo, useState } from "react";

const qualificationOptions = ["pending", "qualified", "rejected"] as const;
const operationalOptions = ["active", "suspended"] as const;
const billingStatusOptions = [
  "unconfigured",
  "pending_payment",
  "active",
  "past_due",
  "canceled",
] as const;
const billingModeOptions = ["none", "standard_checkout", "enterprise_invoice"] as const;
const billingAccessOverrideOptions = [
  "none",
  "temporary_allow",
  "temporary_block",
] as const;
const planTypeOptions = ["none", "starter", "growth", "scale", "custom"] as const;
const memberRoleOptions = ["member", "owner"] as const;

type QualificationStatus = (typeof qualificationOptions)[number];
type OperationalStatus = (typeof operationalOptions)[number];
type BillingStatus = (typeof billingStatusOptions)[number];
type BillingMode = (typeof billingModeOptions)[number];
type BillingAccessOverride = (typeof billingAccessOverrideOptions)[number];
type PlanType = (typeof planTypeOptions)[number];
type MemberRole = (typeof memberRoleOptions)[number];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function SimpleSelect({
  value,
  onChange,
  options,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<string>;
  id: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full border border-border bg-background px-3 type-p focus-visible:outline-none"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function AdminBrandDetail({ brandId }: { brandId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [qualificationStatus, setQualificationStatus] =
    useState<QualificationStatus>("pending");
  const [operationalStatus, setOperationalStatus] =
    useState<OperationalStatus>("active");
  const [billingStatus, setBillingStatus] = useState<BillingStatus>("unconfigured");
  const [billingMode, setBillingMode] = useState<BillingMode>("none");
  const [billingAccessOverride, setBillingAccessOverride] =
    useState<BillingAccessOverride>("none");
  const [planType, setPlanType] = useState<PlanType>("none");
  const [planCurrency, setPlanCurrency] = useState("EUR");
  const [customMonthlyPrice, setCustomMonthlyPrice] = useState("");

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("member");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");

  const brandDetailQuery = useQuery({
    ...trpc.admin.brands.get.queryOptions({ brand_id: brandId }),
  });

  const auditQuery = useQuery({
    ...trpc.admin.audit.list.queryOptions({ brand_id: brandId, limit: 50 }),
  });

  const brand = brandDetailQuery.data?.brand;
  const members = brandDetailQuery.data?.members ?? [];
  const pendingInvites = brandDetailQuery.data?.pending_invites ?? [];

  const canSaveControl = useMemo(
    () => !brandDetailQuery.isLoading && !brandDetailQuery.isError,
    [brandDetailQuery.isError, brandDetailQuery.isLoading],
  );

  useEffect(() => {
    const control = brandDetailQuery.data?.control;
    if (!control) {
      return;
    }

    setQualificationStatus(control.qualification_status as QualificationStatus);
    setOperationalStatus(control.operational_status as OperationalStatus);
    setBillingStatus(control.billing_status as BillingStatus);
    setBillingMode((control.billing_mode ?? "none") as BillingMode);
    setBillingAccessOverride(
      control.billing_access_override as BillingAccessOverride,
    );
    setPlanType((control.plan_type ?? "none") as PlanType);
    setPlanCurrency(control.plan_currency || "EUR");
    setCustomMonthlyPrice(
      control.custom_monthly_price_cents != null
        ? String(control.custom_monthly_price_cents)
        : "",
    );
  }, [brandDetailQuery.data?.control]);

  async function refreshBrandData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.admin.brands.get.queryKey({ brand_id: brandId }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.admin.brands.list.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.admin.audit.list.queryKey({ brand_id: brandId, limit: 50 }),
      }),
    ]);
  }

  const updateControlMutation = useMutation(
    trpc.admin.brands.updateControl.mutationOptions({
      onSuccess: async () => {
        await refreshBrandData();
        toast.success("Brand control updated");
      },
      onError: (mutationError) => {
        toast.error(mutationError.message || "Failed to update brand control");
      },
    }),
  );

  const addMemberMutation = useMutation(
    trpc.admin.members.add.mutationOptions({
      onSuccess: async () => {
        await refreshBrandData();
        toast.success("Member added");
      },
      onError: (mutationError) => {
        toast.error(mutationError.message || "Failed to add member");
      },
    }),
  );

  const removeMemberMutation = useMutation(
    trpc.admin.members.remove.mutationOptions({
      onSuccess: async () => {
        await refreshBrandData();
        toast.success("Member removed");
      },
      onError: (mutationError) => {
        toast.error(mutationError.message || "Failed to remove member");
      },
    }),
  );

  const sendInviteMutation = useMutation(
    trpc.admin.invites.send.mutationOptions({
      onSuccess: async () => {
        await refreshBrandData();
        toast.success("Invite sent");
      },
      onError: (mutationError) => {
        toast.error(mutationError.message || "Failed to send invite");
      },
    }),
  );

  const revokeInviteMutation = useMutation(
    trpc.admin.invites.revoke.mutationOptions({
      onSuccess: async () => {
        await refreshBrandData();
        toast.success("Invite revoked");
      },
      onError: (mutationError) => {
        toast.error(mutationError.message || "Failed to revoke invite");
      },
    }),
  );

  async function handleSaveControl() {
    const normalizedPlanCurrency = planCurrency.trim().toUpperCase();

    if (normalizedPlanCurrency.length !== 3) {
      toast.error("Plan currency must be a 3-letter ISO code");
      return;
    }

    let parsedCustomPrice: number | null = null;

    if (planType === "custom") {
      if (!customMonthlyPrice.trim()) {
        toast.error("Custom plan requires a monthly price in cents");
        return;
      }

      const parsed = Number.parseInt(customMonthlyPrice, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Custom monthly price must be a positive number");
        return;
      }

      parsedCustomPrice = parsed;
    }

    await updateControlMutation.mutateAsync({
      brand_id: brandId,
      qualification_status: qualificationStatus,
      operational_status: operationalStatus,
      billing_status: billingStatus,
      billing_mode: billingMode === "none" ? null : billingMode,
      billing_access_override: billingAccessOverride,
      plan_type: planType === "none" ? null : planType,
      plan_currency: normalizedPlanCurrency,
      custom_monthly_price_cents: parsedCustomPrice,
    });
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = memberEmail.trim();
    if (!email) {
      toast.error("Member email is required");
      return;
    }

    await addMemberMutation.mutateAsync({
      brand_id: brandId,
      email,
      role: memberRole,
    });

    setMemberEmail("");
  }

  async function handleSendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = inviteEmail.trim();
    if (!email) {
      toast.error("Invite email is required");
      return;
    }

    await sendInviteMutation.mutateAsync({
      brand_id: brandId,
      email,
      role: inviteRole,
    });

    setInviteEmail("");
  }

  if (brandDetailQuery.isLoading) {
    return <p className="text-secondary">Loading brand details...</p>;
  }

  if (brandDetailQuery.isError || !brand) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">Failed to load brand details.</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => brandDetailQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground">{brand.name}</h2>
        <p className="type-small text-secondary">Brand ID: {brand.id}</p>
      </div>

      <section className="border">
        <div className="border-b px-4 py-3">
          <h6 className="text-foreground">Brand identity</h6>
        </div>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <div>
            <p className="type-small text-secondary">Slug</p>
            <p className="text-foreground">{brand.slug ?? "-"}</p>
          </div>
          <div>
            <p className="type-small text-secondary">Email</p>
            <p className="text-foreground">{brand.email ?? "-"}</p>
          </div>
          <div>
            <p className="type-small text-secondary">Country</p>
            <p className="text-foreground">{brand.country_code ?? "-"}</p>
          </div>
          <div>
            <p className="type-small text-secondary">Logo URL</p>
            <p className="text-foreground break-all">{brand.logo_url ?? "-"}</p>
          </div>
          <div>
            <p className="type-small text-secondary">Created</p>
            <p className="text-foreground">{formatDateTime(brand.created_at)}</p>
          </div>
          <div>
            <p className="type-small text-secondary">Updated</p>
            <p className="text-foreground">{formatDateTime(brand.updated_at)}</p>
          </div>
        </div>
      </section>

      <section className="border">
        <div className="border-b px-4 py-3">
          <h6 className="text-foreground">Lifecycle and billing control</h6>
        </div>

        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="qualification-status">Qualification status</Label>
            <SimpleSelect
              id="qualification-status"
              value={qualificationStatus}
              onChange={(value) =>
                setQualificationStatus(value as QualificationStatus)
              }
              options={qualificationOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="operational-status">Operational status</Label>
            <SimpleSelect
              id="operational-status"
              value={operationalStatus}
              onChange={(value) => setOperationalStatus(value as OperationalStatus)}
              options={operationalOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billing-status">Billing status</Label>
            <SimpleSelect
              id="billing-status"
              value={billingStatus}
              onChange={(value) => setBillingStatus(value as BillingStatus)}
              options={billingStatusOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billing-mode">Billing mode</Label>
            <SimpleSelect
              id="billing-mode"
              value={billingMode}
              onChange={(value) => setBillingMode(value as BillingMode)}
              options={billingModeOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billing-access-override">Billing access override</Label>
            <SimpleSelect
              id="billing-access-override"
              value={billingAccessOverride}
              onChange={(value) =>
                setBillingAccessOverride(value as BillingAccessOverride)
              }
              options={billingAccessOverrideOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-type">Plan type</Label>
            <SimpleSelect
              id="plan-type"
              value={planType}
              onChange={(value) => setPlanType(value as PlanType)}
              options={planTypeOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-currency">Plan currency</Label>
            <Input
              id="plan-currency"
              value={planCurrency}
              onChange={(event) => setPlanCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              placeholder="EUR"
            />
          </div>

          {planType === "custom" ? (
            <div className="space-y-1.5">
              <Label htmlFor="custom-price">Custom monthly price (cents)</Label>
              <Input
                id="custom-price"
                type="number"
                min={1}
                value={customMonthlyPrice}
                onChange={(event) => setCustomMonthlyPrice(event.target.value)}
                placeholder="50000"
              />
            </div>
          ) : null}
        </div>

        <div className="border-t px-4 py-3">
          <Button
            type="button"
            onClick={handleSaveControl}
            disabled={!canSaveControl || updateControlMutation.isPending}
          >
            {updateControlMutation.isPending ? "Saving..." : "Save control"}
          </Button>
        </div>
      </section>

      <section className="border">
        <div className="border-b px-4 py-3">
          <h6 className="text-foreground">Members</h6>
        </div>

        <form
          className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
          onSubmit={handleAddMember}
        >
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="member-email">Add existing user by email</Label>
            <Input
              id="member-email"
              type="email"
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              placeholder="user@brand.com"
            />
          </div>

          <div className="w-[160px] space-y-1.5">
            <Label htmlFor="member-role">Role</Label>
            <SimpleSelect
              id="member-role"
              value={memberRole}
              onChange={(value) => setMemberRole(value as MemberRole)}
              options={memberRoleOptions}
            />
          </div>

          <Button type="submit" disabled={addMemberMutation.isPending}>
            {addMemberMutation.isPending ? "Adding..." : "Add member"}
          </Button>
        </form>

        {members.length === 0 ? (
          <p className="px-4 py-6 text-secondary">No members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Added
                  </th>
                  <th className="px-4 py-2 text-right type-small text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.user_id} className="border-b">
                    <td className="px-4 py-3 text-foreground">
                      {member.full_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 type-small text-secondary">
                      {member.email ?? "-"}
                    </td>
                    <td className="px-4 py-3 type-small text-secondary">
                      {member.role}
                    </td>
                    <td className="px-4 py-3 type-small text-secondary">
                      {formatDateTime(member.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border">
        <div className="border-b px-4 py-3">
          <h6 className="text-foreground">Pending invites</h6>
        </div>

        <form
          className="flex flex-wrap items-end gap-2 border-b px-4 py-3"
          onSubmit={handleSendInvite}
        >
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Invite email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="invitee@brand.com"
            />
          </div>

          <div className="w-[160px] space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <SimpleSelect
              id="invite-role"
              value={inviteRole}
              onChange={(value) => setInviteRole(value as MemberRole)}
              options={memberRoleOptions}
            />
          </div>

          <Button type="submit" disabled={sendInviteMutation.isPending}>
            {sendInviteMutation.isPending ? "Sending..." : "Send invite"}
          </Button>
        </form>

        {pendingInvites.length === 0 ? (
          <p className="px-4 py-6 text-secondary">No pending invites.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Created
                  </th>
                  <th className="px-4 py-2 text-left type-small text-secondary">
                    Expires
                  </th>
                  <th className="px-4 py-2 text-right type-small text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="border-b">
                    <td className="px-4 py-3 type-small text-secondary">
                      {invite.email}
                    </td>
                    <td className="px-4 py-3 type-small text-secondary">
                      {invite.role}
                    </td>
                    <td className="px-4 py-3 type-small text-secondary">
                      {formatDateTime(invite.created_at)}
                    </td>
                    <td className="px-4 py-3 type-small text-secondary">
                      {invite.expires_at ? formatDateTime(invite.expires_at) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          revokeInviteMutation.mutate({ invite_id: invite.id })
                        }
                        disabled={revokeInviteMutation.isPending}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border">
        <div className="border-b px-4 py-3">
          <h6 className="text-foreground">Audit log</h6>
        </div>

        {auditQuery.isLoading ? (
          <p className="px-4 py-6 text-secondary">Loading audit events...</p>
        ) : auditQuery.isError ? (
          <p className="px-4 py-6 text-destructive">
            Failed to load audit events.
          </p>
        ) : !auditQuery.data || auditQuery.data.length === 0 ? (
          <p className="px-4 py-6 text-secondary">No audit events found.</p>
        ) : (
          <div className="divide-y">
            {auditQuery.data.map((event) => (
              <div key={event.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-foreground">{event.action}</p>
                  <p className="type-small text-secondary">
                    {formatDateTime(event.created_at)}
                  </p>
                </div>
                <p className="type-small text-secondary">
                  Actor: {event.actor_email || "unknown"}
                </p>
                {event.metadata ? (
                  <pre className="overflow-x-auto border px-2 py-1 type-small text-secondary whitespace-pre-wrap break-words">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
