import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "../../client";
import { DEFAULT_BRAND_CONTROL_VALUES } from "../brand/control";
import { brandControl, brandInvites, brandMembers, brands, users } from "../../schema";

export interface AdminBrandControlSnapshot {
  qualificationStatus: string;
  operationalStatus: string;
  billingStatus: string;
  billingMode: string | null;
  billingAccessOverride: string;
  planType: string | null;
  planCurrency: string;
  customMonthlyPriceCents: number | null;
}

export interface AdminBrandListItem {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  countryCode: string | null;
  logoPath: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  memberCount: number;
  pendingInviteCount: number;
  control: AdminBrandControlSnapshot;
}

export interface AdminBrandMemberItem {
  userId: string;
  email: string | null;
  fullName: string | null;
  avatarPath: string | null;
  role: "owner" | "member";
  createdAt: string;
}

export interface AdminBrandInviteItem {
  id: string;
  email: string;
  role: "owner" | "member";
  createdAt: string;
  expiresAt: string | null;
  invitedByUserId: string | null;
  invitedByEmail: string | null;
  invitedByFullName: string | null;
}

export interface AdminBrandDetail {
  brand: {
    id: string;
    name: string;
    slug: string | null;
    email: string | null;
    countryCode: string | null;
    logoPath: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
  control: AdminBrandControlSnapshot;
  members: AdminBrandMemberItem[];
  pendingInvites: AdminBrandInviteItem[];
}

export class AdminBrandNotFoundError extends Error {
  constructor() {
    super("BRAND_NOT_FOUND");
    this.name = "AdminBrandNotFoundError";
  }
}

function mapControlSnapshot(row: {
  qualificationStatus: string | null;
  operationalStatus: string | null;
  billingStatus: string | null;
  billingMode: string | null;
  billingAccessOverride: string | null;
  planType: string | null;
  planCurrency: string | null;
  customMonthlyPriceCents: number | null;
}): AdminBrandControlSnapshot {
  return {
    qualificationStatus:
      row.qualificationStatus ?? DEFAULT_BRAND_CONTROL_VALUES.qualificationStatus,
    operationalStatus:
      row.operationalStatus ?? DEFAULT_BRAND_CONTROL_VALUES.operationalStatus,
    billingStatus: row.billingStatus ?? DEFAULT_BRAND_CONTROL_VALUES.billingStatus,
    billingMode: row.billingMode ?? DEFAULT_BRAND_CONTROL_VALUES.billingMode,
    billingAccessOverride:
      row.billingAccessOverride ?? DEFAULT_BRAND_CONTROL_VALUES.billingAccessOverride,
    planType: row.planType ?? DEFAULT_BRAND_CONTROL_VALUES.planType,
    planCurrency: row.planCurrency ?? DEFAULT_BRAND_CONTROL_VALUES.planCurrency,
    customMonthlyPriceCents:
      row.customMonthlyPriceCents ??
      DEFAULT_BRAND_CONTROL_VALUES.customMonthlyPriceCents,
  };
}

export async function listAdminBrands(
  db: Database,
  input: {
    search?: string | null;
    limit?: number | null;
    offset?: number | null;
    includeDeleted?: boolean | null;
  } = {},
): Promise<{ items: AdminBrandListItem[]; total: number }> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const offset = Math.max(0, input.offset ?? 0);
  const includeDeleted = input.includeDeleted === true;
  const searchTerm = input.search?.trim() ?? "";

  const conditions = [];

  if (!includeDeleted) {
    conditions.push(isNull(brands.deletedAt));
  }

  if (searchTerm.length > 0) {
    const likeTerm = `%${searchTerm}%`;
    conditions.push(
      or(
        ilike(brands.name, likeTerm),
        ilike(brands.slug, likeTerm),
        ilike(brands.email, likeTerm),
      ),
    );
  }

  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const baseQuery = db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      email: brands.email,
      countryCode: brands.countryCode,
      logoPath: brands.logoPath,
      createdAt: brands.createdAt,
      updatedAt: brands.updatedAt,
      deletedAt: brands.deletedAt,
      qualificationStatus: brandControl.qualificationStatus,
      operationalStatus: brandControl.operationalStatus,
      billingStatus: brandControl.billingStatus,
      billingMode: brandControl.billingMode,
      billingAccessOverride: brandControl.billingAccessOverride,
      planType: brandControl.planType,
      planCurrency: brandControl.planCurrency,
      customMonthlyPriceCents: brandControl.customMonthlyPriceCents,
    })
    .from(brands)
    .leftJoin(brandControl, eq(brandControl.brandId, brands.id));

  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(brands.createdAt))
    .limit(limit)
    .offset(offset);

  const totalQuery = db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(brands);

  const totalRows = await (whereClause
    ? totalQuery.where(whereClause)
    : totalQuery);
  const total = totalRows[0]?.count ?? 0;

  if (rows.length === 0) {
    return { items: [], total };
  }

  const brandIds = rows.map((row) => row.id);
  const nowIso = new Date().toISOString();

  const memberCountRows = await db
    .select({
      brandId: brandMembers.brandId,
      count: sql<number>`count(*)::int`,
    })
    .from(brandMembers)
    .where(inArray(brandMembers.brandId, brandIds))
    .groupBy(brandMembers.brandId);

  const pendingInviteCountRows = await db
    .select({
      brandId: brandInvites.brandId,
      count: sql<number>`count(*)::int`,
    })
    .from(brandInvites)
    .where(
      and(
        inArray(brandInvites.brandId, brandIds),
        or(isNull(brandInvites.expiresAt), gt(brandInvites.expiresAt, nowIso)),
      ),
    )
    .groupBy(brandInvites.brandId);

  const memberCountMap = new Map(
    memberCountRows.map((row) => [row.brandId, row.count]),
  );
  const pendingInviteCountMap = new Map(
    pendingInviteCountRows.map((row) => [row.brandId, row.count]),
  );

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      email: row.email,
      countryCode: row.countryCode,
      logoPath: row.logoPath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      memberCount: memberCountMap.get(row.id) ?? 0,
      pendingInviteCount: pendingInviteCountMap.get(row.id) ?? 0,
      control: mapControlSnapshot(row),
    })),
  };
}

export async function getAdminBrandDetail(
  db: Database,
  brandId: string,
): Promise<AdminBrandDetail | null> {
  const [brandRow] = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      email: brands.email,
      countryCode: brands.countryCode,
      logoPath: brands.logoPath,
      createdAt: brands.createdAt,
      updatedAt: brands.updatedAt,
      deletedAt: brands.deletedAt,
      qualificationStatus: brandControl.qualificationStatus,
      operationalStatus: brandControl.operationalStatus,
      billingStatus: brandControl.billingStatus,
      billingMode: brandControl.billingMode,
      billingAccessOverride: brandControl.billingAccessOverride,
      planType: brandControl.planType,
      planCurrency: brandControl.planCurrency,
      customMonthlyPriceCents: brandControl.customMonthlyPriceCents,
    })
    .from(brands)
    .leftJoin(brandControl, eq(brandControl.brandId, brands.id))
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!brandRow) return null;

  const members = await db
    .select({
      userId: brandMembers.userId,
      email: users.email,
      fullName: users.fullName,
      avatarPath: users.avatarPath,
      role: brandMembers.role,
      createdAt: brandMembers.createdAt,
    })
    .from(brandMembers)
    .leftJoin(users, eq(users.id, brandMembers.userId))
    .where(eq(brandMembers.brandId, brandId))
    .orderBy(asc(brandMembers.createdAt));

  const nowIso = new Date().toISOString();
  const pendingInvites = await db
    .select({
      id: brandInvites.id,
      email: brandInvites.email,
      role: brandInvites.role,
      createdAt: brandInvites.createdAt,
      expiresAt: brandInvites.expiresAt,
      invitedByUserId: brandInvites.createdBy,
      invitedByEmail: users.email,
      invitedByFullName: users.fullName,
    })
    .from(brandInvites)
    .leftJoin(users, eq(users.id, brandInvites.createdBy))
    .where(
      and(
        eq(brandInvites.brandId, brandId),
        or(isNull(brandInvites.expiresAt), gt(brandInvites.expiresAt, nowIso)),
      ),
    )
    .orderBy(desc(brandInvites.createdAt));

  return {
    brand: {
      id: brandRow.id,
      name: brandRow.name,
      slug: brandRow.slug,
      email: brandRow.email,
      countryCode: brandRow.countryCode,
      logoPath: brandRow.logoPath,
      createdAt: brandRow.createdAt,
      updatedAt: brandRow.updatedAt,
      deletedAt: brandRow.deletedAt,
    },
    control: mapControlSnapshot(brandRow),
    members: members.map((member) => ({
      userId: member.userId,
      email: member.email,
      fullName: member.fullName,
      avatarPath: member.avatarPath,
      role: member.role === "owner" ? "owner" : "member",
      createdAt: member.createdAt,
    })),
    pendingInvites: pendingInvites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role === "owner" ? "owner" : "member",
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      invitedByUserId: invite.invitedByUserId,
      invitedByEmail: invite.invitedByEmail,
      invitedByFullName: invite.invitedByFullName,
    })),
  };
}

export async function assertAdminBrandExists(
  db: Database,
  brandId: string,
): Promise<void> {
  const [brand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)))
    .limit(1);

  if (!brand) {
    throw new AdminBrandNotFoundError();
  }
}
