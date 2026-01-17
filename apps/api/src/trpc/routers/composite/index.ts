import type { Database } from "@v1/db/client";
import { and, asc, desc, eq, inArray } from "@v1/db/queries";
import {
  type BrandMembershipListItem,
  type UserInviteSummaryRow,
  getBrandsByUserId,
  getOwnerCountsByBrandIds,
  listPendingInvitesForEmail,
} from "@v1/db/queries/brand";
import {
  listAllBrandAttributeValues,
  listBrandAttributes,
  listBrandManufacturers,
  listBrandTags,
  listCertifications,
  listMaterials,
  listOperators,
  listSeasonsForBrand,
} from "@v1/db/queries/catalog";
import {
  listTaxonomyAttributes,
  listTaxonomyCategories,
  listTaxonomyValues,
} from "@v1/db/queries/taxonomy";
import { getUserById } from "@v1/db/queries/user";
import { brandInvites, brandMembers, users } from "@v1/db/schema";
import { getAppUrl } from "@v1/utils/envs";
/**
 * Composite endpoints router implementation.
 *
 * Performance-optimized batch queries that stitch multiple domain reads
 * together for dashboard and form initialization.
 *
 * Targets:
 * - composite.initDashboard (renamed from workflowInit in Phase 6)
 * - composite.membersWithInvites
 * - composite.catalogContent (renamed from brandCatalogContent in Phase 6)
 */
import { ROLES } from "../../../config/roles.js";
import { brandIdOptionalSchema } from "../../../schemas/brand.js";
import { badRequest, unauthorized, wrapError } from "../../../utils/errors.js";
import { createEntityResponse } from "../../../utils/response.js";
import {
  type AuthenticatedTRPCContext,
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../init.js";

/** User's role within a brand */
type BrandRole = "owner" | "member";
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

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
 * Constructs a publicly accessible URL for a user avatar.
 *
 * Encodes each path segment to handle special characters and constructs
 * a URL pointing to the user avatars storage endpoint.
 *
 * @param path - Relative storage path (e.g., "user-123/avatar.png")
 * @returns Full URL to avatar, or null if no path provided
 */
function buildUserAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/avatars/${encoded}`;
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
    avatar_url: buildUserAvatarUrl(record.avatarPath),
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
    brand_id: invite.brandId ?? null,
    brand_name: invite.brandName,
    brand_logo: buildBrandLogoUrl(invite.brandLogoPath ?? null),
    role: invite.role,
    invited_by: invite.invitedByFullName ?? invite.invitedByEmail ?? null,
    invited_by_avatar_url: buildUserAvatarUrl(invite.invitedByAvatarPath),
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

  // Batch fetch owner counts for all relevant brands using standardized query
  const ownerCounts = await getOwnerCountsByBrandIds(db, ownerBrandIds);

  return memberships.map((membership) => {
    const ownerCount = ownerCounts.get(membership.id) ?? 1;
    const role =
      membership.role === "owner" ? ("owner" as const) : ("member" as const);
    return {
      id: membership.id,
      name: membership.name,
      slug: membership.slug ?? null,
      email: membership.email ?? null,
      country_code: membership.country_code ?? null,
      logo_url: buildBrandLogoUrl(membership.logo_path ?? null),
      role,
      canLeave: canLeaveFromRole(role, ownerCount),
    };
  });
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
      avatarPath: users.avatarPath,
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
      avatar_url: buildUserAvatarUrl(member.avatarPath),
      role,
      canLeave: canLeaveFromRole(role, ownerCount),
    };
  });
}

/**
 * Fetches all pending invitations for a brand.
 *
 * Queries brand invites with inviter details (who sent the invite) and
 * the invitee email address. Does not include invitee account information
 * as we assume the invitee may not yet have an account.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @returns Array of pending invites with email, role, inviter, and expiration
 */
async function fetchWorkflowInvites(db: Database, brandId: string) {
  const rows = await db
    .select({
      id: brandInvites.id,
      email: brandInvites.email,
      role: brandInvites.role,
      created_at: brandInvites.createdAt,
      expires_at: brandInvites.expiresAt,
      // Inviter data (who sent the invite)
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
    expires_at: invite.expires_at,
  }));
}

type WorkflowInviteList = Awaited<ReturnType<typeof fetchWorkflowInvites>>;

/**
 * Router containing composite endpoints that stitch multiple domain reads
 * together for optimized dashboard and form initialization.
 */
export const compositeRouter = createTRPCRouter({
  /**
   * Fetches user profile, brand memberships, and personal invites in one call.
   *
   * Replaces three individual network requests made during dashboard layout
   * hydration to reduce paint time.
   *
   * Renamed from `workflowInit` in Phase 6.
   */
  initDashboard: protectedProcedure.query(async ({ ctx }) => {
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
   * Combines workflow members and pending invites for the selected brand.
   */
  membersWithInvites: brandRequiredProcedure
    .input(brandIdOptionalSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId, role } = ctx;
      if (input.brand_id !== undefined && brandId !== input.brand_id) {
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
   * Bundled reference data for passport form initialization.
   *
   * Returns brand catalog entities and global categories in a single call to
   * minimize waterfall requests in the app.
   *
   * Renamed from `brandCatalogContent` in Phase 6.
   */
  catalogContent: brandRequiredProcedure.query(async ({ ctx }) => {
    const brandCtx = ctx as BrandContext;
    const brandId = brandCtx.brandId;

    try {
      const [
        categories,
        taxonomyAttributes,
        taxonomyValues,
        brandAttributes,
        brandAttributeValues,
        materials,
        operators,
        manufacturers,
        certifications,
        tags,
        seasons,
      ] = await Promise.all([
        listTaxonomyCategories(brandCtx.db),
        listTaxonomyAttributes(brandCtx.db),
        listTaxonomyValues(brandCtx.db),
        listBrandAttributes(brandCtx.db, brandId),
        listAllBrandAttributeValues(brandCtx.db, brandId),
        listMaterials(brandCtx.db, brandId),
        listOperators(brandCtx.db, brandId),
        listBrandManufacturers(brandCtx.db, brandId),
        listCertifications(brandCtx.db, brandId),
        listBrandTags(brandCtx.db, brandId),
        listSeasonsForBrand(brandCtx.db, brandId),
      ]);

      return {
        categories,
        taxonomy: {
          attributes: taxonomyAttributes,
          values: taxonomyValues,
        },
        brandCatalog: {
          attributes: brandAttributes,
          attributeValues: brandAttributeValues,
          materials,
          operators,
          manufacturers,
          certifications,
          tags,
          seasons,
        },
      };
    } catch (error) {
      throw wrapError(error, "Failed to load passport form references");
    }
  }),
});

export type CompositeRouter = typeof compositeRouter;
