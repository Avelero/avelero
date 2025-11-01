import type { Database } from "@v1/db/client";
import {
  type BrandMembershipListItem,
  type ModuleIncompleteCount,
  type UserInviteSummaryRow,
  countPassportsByStatus,
  getBrandsByUserId,
  getIncompleteCountsByModuleForBrand,
  getUserById,
  listCategories,
  listCertifications,
  listColors,
  listEcoClaims,
  listFacilities,
  listMaterials,
  listPassportsForBrand,
  listPendingInvitesForEmail,
  listShowcaseBrands,
  listSizes,
} from "@v1/db/queries";
import { brandInvites, brandMembers, users } from "@v1/db/schema";
import { getAppUrl } from "@v1/utils/envs";
/**
 * Composite endpoints router implementation.
 *
 * Targets:
 * - composite.workflowInit
 * - composite.dashboard
 * - composite.membersWithInvites
 * - composite.passportFormReferences
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ROLES } from "../../../config/roles.js";
import { workflowBrandIdSchema } from "../../../schemas/workflow.js";
import { badRequest, unauthorized, wrapError } from "../../../utils/errors.js";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../init.js";

type BrandRole = "owner" | "member";

interface MinimalUserRecord {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarPath: string | null;
  brandId: string | null;
}

interface DashboardRecentActivity {
  passport_id: string;
  upid: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ModuleCompletionMetric {
  module_key: string;
  completed: number;
  incomplete: number;
  total: number;
}

function buildBrandLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/brand-avatars/${encoded}`;
}

function canLeaveFromRole(role: BrandRole, ownerCount: number): boolean {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

function mapUserProfile(
  record: MinimalUserRecord | null,
  fallbackEmail: string | null,
) {
  if (!record) return null;
  const email = record.email ?? fallbackEmail;
  if (!email) {
    throw unauthorized("Email address required to fetch user profile");
  }

  return {
    id: record.id,
    email,
    full_name: record.fullName ?? null,
    avatar_url: record.avatarPath ?? null,
    brand_id: record.brandId ?? null,
  };
}

function mapInvite(invite: UserInviteSummaryRow) {
  return {
    id: invite.id,
    brand_name: invite.brandName,
    brand_logo: invite.brandLogoPath,
    role: invite.role,
    invited_by: invite.invitedByFullName ?? invite.invitedByEmail ?? null,
    created_at: invite.createdAt,
    expires_at: invite.expiresAt,
  };
}

async function mapWorkflowBrands(
  db: Database,
  memberships: BrandMembershipListItem[],
) {
  if (memberships.length === 0) return [];

  const ownerBrandIds = memberships
    .filter((brand) => brand.role === "owner")
    .map((brand) => brand.id);

  const ownerCounts = new Map<string, number>();
  if (ownerBrandIds.length > 0) {
    const rows = await db
      .select({
        brandId: brandMembers.brandId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(brandMembers)
      .where(
        and(
          inArray(brandMembers.brandId, ownerBrandIds),
          eq(brandMembers.role, "owner"),
        ),
      )
      .groupBy(brandMembers.brandId);

    for (const row of rows) {
      ownerCounts.set(row.brandId, row.count);
    }
  }

  return memberships.map((membership) => {
    const ownerCount = ownerCounts.get(membership.id) ?? 1;
    const role =
      membership.role === "owner" ? ("owner" as const) : ("member" as const);
    return {
      id: membership.id,
      name: membership.name,
      email: membership.email ?? null,
      country_code: membership.country_code ?? null,
      avatar_hue: membership.avatar_hue ?? null,
      logo_url: buildBrandLogoUrl(membership.logo_path ?? null),
      role,
      canLeave: canLeaveFromRole(role, ownerCount),
    };
  });
}

function mapModuleCompletionMetric(
  metric: ModuleIncompleteCount,
): ModuleCompletionMetric {
  return {
    module_key: metric.moduleKey,
    completed: metric.completed,
    incomplete: metric.incomplete,
    total: metric.total,
  };
}

function mapRecentActivity(
  summaries: readonly {
    id: string;
    upid: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }[],
): DashboardRecentActivity[] {
  return summaries
    .map((passport) => ({
      passport_id: passport.id,
      upid: passport.upid,
      title: passport.title,
      status: passport.status,
      created_at: passport.createdAt,
      updated_at: passport.updatedAt,
    }))
    .sort((a, b) =>
      a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0,
    );
}

async function fetchWorkflowMembers(db: Database, brandId: string) {
  const rows = await db
    .select({
      userId: brandMembers.userId,
      email: users.email,
      fullName: users.fullName,
      role: brandMembers.role,
    })
    .from(brandMembers)
    .leftJoin(users, eq(users.id, brandMembers.userId))
    .where(eq(brandMembers.brandId, brandId))
    .orderBy(asc(brandMembers.createdAt));

  const ownerCount = rows.reduce(
    (count, member) => (member.role === "owner" ? count + 1 : count),
    0,
  );

  return rows.map((member) => {
    const role =
      member.role === "owner" ? ("owner" as const) : ("member" as const);
    return {
      user_id: member.userId,
      email: member.email ?? null,
      full_name: member.fullName ?? null,
      role,
      canLeave: canLeaveFromRole(role, ownerCount),
    };
  });
}

async function fetchWorkflowInvites(db: Database, brandId: string) {
  const rows = await db
    .select({
      id: brandInvites.id,
      email: brandInvites.email,
      role: brandInvites.role,
      created_at: brandInvites.createdAt,
      invitedByEmail: users.email,
      invitedByFullName: users.fullName,
    })
    .from(brandInvites)
    .leftJoin(users, eq(users.id, brandInvites.createdBy))
    .where(eq(brandInvites.brandId, brandId))
    .orderBy(desc(brandInvites.createdAt));

  return rows.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    invited_by:
      invite.invitedByFullName ?? invite.invitedByEmail ?? "Avelero Team",
    created_at: invite.created_at,
  }));
}

type WorkflowInviteList = Awaited<ReturnType<typeof fetchWorkflowInvites>>;

/**
 * Router containing composite endpoints that stitch multiple domain reads
 * together for optimized dashboard and form initialization.
 */
export const compositeRouter = createTRPCRouter({
  /**
   * Fetches user profile, workflow memberships, and personal invites in one call.
   *
   * Replaces three individual network requests made during dashboard layout
   * hydration to reduce paint time.
   */
  workflowInit: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    const email = user.email ?? null;

    const [profileRecord, memberships] = await Promise.all([
      getUserById(db, user.id),
      getBrandsByUserId(db, user.id),
    ]);

    const [brands, invites] = await Promise.all([
      mapWorkflowBrands(db, memberships),
      (async () => {
        if (!email) {
          throw unauthorized("Email address required to list invites");
        }
        const inviteRows = await listPendingInvitesForEmail(db, email);
        return inviteRows.map(mapInvite);
      })(),
    ]);

    return {
      user: mapUserProfile(profileRecord, email),
      brands,
      myInvites: invites,
    };
  }),

  /**
   * Aggregates dashboard data (status counts, recent passport activity, and module metrics).
   */
  dashboard: brandRequiredProcedure.query(async ({ ctx }) => {
    const { db, brandId } = ctx;

    try {
      const [statusCounts, passportListing, moduleMetrics] = await Promise.all([
        countPassportsByStatus(db, brandId),
        listPassportsForBrand(db, brandId, { page: 0 }),
        getIncompleteCountsByModuleForBrand(db, brandId),
      ]);

      const recentActivity = mapRecentActivity(
        passportListing.data.slice(0, 10).map((passport) => ({
          id: passport.id,
          upid: passport.upid,
          title: passport.title,
          status: passport.status,
          createdAt: passport.createdAt,
          updatedAt: passport.updatedAt,
        })),
      );

      const metrics = {
        totals: {
          passports: passportListing.meta.total,
        },
        module_completion: moduleMetrics.map(mapModuleCompletionMetric),
      };

      return {
        statusCounts,
        recentActivity,
        metrics,
      };
    } catch (error) {
      throw wrapError(error, "Failed to load dashboard composite data");
    }
  }),

  /**
   * Combines workflow members and pending invites for the selected brand.
   */
  membersWithInvites: brandRequiredProcedure
    .input(workflowBrandIdSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId, role } = ctx;
      if (brandId !== input.brand_id) {
        throw badRequest("Active brand does not match the requested workflow");
      }

      const invitesPromise: Promise<WorkflowInviteList> =
        role === ROLES.OWNER
          ? fetchWorkflowInvites(db, brandId)
          : Promise.resolve<WorkflowInviteList>([]);

      const [members, invites] = await Promise.all([
        fetchWorkflowMembers(db, brandId),
        invitesPromise,
      ]);

      return { members, invites };
    }),

  /**
   * Provides all reference data required to render the passport form in one round trip.
   */
  passportFormReferences: brandRequiredProcedure.query(async ({ ctx }) => {
    const { db, brandId } = ctx;

    try {
      const [
        categories,
        materials,
        facilities,
        colors,
        sizes,
        certifications,
        ecoClaims,
        operators,
      ] = await Promise.all([
        listCategories(db),
        listMaterials(db, brandId),
        listFacilities(db, brandId),
        listColors(db, brandId),
        listSizes(db, brandId),
        listCertifications(db, brandId),
        listEcoClaims(db, brandId),
        listShowcaseBrands(db, brandId),
      ]);

      return {
        categories,
        brandCatalog: {
          materials,
          facilities,
          colors,
          sizes,
          certifications,
          ecoClaims,
          operators,
        },
      };
    } catch (error) {
      throw wrapError(error, "Failed to load passport form references");
    }
  }),
});

export type CompositeRouter = typeof compositeRouter;
