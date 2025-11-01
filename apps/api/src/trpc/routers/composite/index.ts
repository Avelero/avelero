import type { Database } from "@v1/db/client";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
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
import { ROLES } from "../../../config/roles.js";
import { workflowBrandIdSchema } from "../../../schemas/workflow.js";
import { badRequest, unauthorized, wrapError } from "../../../utils/errors.js";
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../init.js";

/** User's role within a brand */
type BrandRole = "owner" | "member";

/**
 * Minimal user record shape for profile mapping.
 */
interface MinimalUserRecord {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarPath: string | null;
  brandId: string | null;
}

/**
 * Recent passport activity item for dashboard display.
 */
interface DashboardRecentActivity {
  passport_id: string;
  upid: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Module completion metrics for dashboard analytics.
 */
interface ModuleCompletionMetric {
  module_key: string;
  completed: number;
  incomplete: number;
  total: number;
}

/**
 * Constructs a publicly accessible URL for a brand logo.
 *
 * Encodes each path segment to handle special characters and constructs
 * a URL pointing to the brand avatars storage endpoint.
 *
 * @param path - Relative storage path (e.g., "brand-123/logo.png")
 * @returns Full URL to logo, or null if no path provided
 */
function buildBrandLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/brand-avatars/${encoded}`;
}

/**
 * Determines if a user can leave a brand based on their role and owner count.
 *
 * Business rule: Sole owners cannot leave their brand. They must either
 * promote another member to owner or delete the brand.
 *
 * @param role - User's role in the brand ("owner" | "member")
 * @param ownerCount - Total number of owners in the brand
 * @returns True if user is allowed to leave
 */
function canLeaveFromRole(role: BrandRole, ownerCount: number): boolean {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

/**
 * Maps database user record to API response format.
 *
 * Ensures email is present (required for user profile) by falling back to
 * a provided email if the record's email is null. Throws unauthorized error
 * if no email is available.
 *
 * @param record - User record from database
 * @param fallbackEmail - Email to use if record.email is null
 * @returns Formatted user profile object
 * @throws {TRPCError} UNAUTHORIZED if no email available
 */
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

/**
 * Maps database invite record to API response format.
 *
 * @param invite - Invite record from database query
 * @returns Formatted invite object for API response
 */
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

/**
 * Maps brand memberships with ownership metadata.
 *
 * Enriches each membership with:
 * - Owner count for the brand (to determine if user can leave)
 * - Logo URL (constructed from storage path)
 * - canLeave flag (based on role and owner count)
 *
 * Performs a single database query to fetch owner counts for all brands
 * where the user is an owner, optimizing performance for bulk operations.
 *
 * @param db - Database instance
 * @param memberships - User's brand memberships
 * @returns Enriched brand memberships with metadata
 */
async function mapWorkflowBrands(
  db: Database,
  memberships: BrandMembershipListItem[],
) {
  if (memberships.length === 0) return [];

  // Extract brands where user is owner (need owner counts for these)
  const ownerBrandIds = memberships
    .filter((brand) => brand.role === "owner")
    .map((brand) => brand.id);

  // Batch fetch owner counts for all relevant brands
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

/**
 * Maps module completion data from database to API format.
 *
 * @param metric - Module completion counts from database
 * @returns Formatted module completion metric
 */
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

/**
 * Maps and sorts passport summaries for recent activity display.
 *
 * Transforms passport records into dashboard activity format and sorts
 * by most recently updated first.
 *
 * @param summaries - Passport summary records
 * @returns Sorted recent activity items (most recent first)
 */
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

/**
 * Fetches all members for a brand with canLeave permissions.
 *
 * Queries brand members with user details and calculates whether each
 * member can leave based on the total owner count. Members are ordered
 * by join date (oldest first).
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @returns Array of brand members with permissions
 */
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

  // Calculate total owner count to determine leave permissions
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

/**
 * Fetches all pending invitations for a brand.
 *
 * Queries brand invites with inviter details (name or email) and orders
 * by most recent first. Invites are filtered to only show pending status.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @returns Array of pending invites with inviter information
 */
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
