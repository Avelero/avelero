/**
 * Brand custom domain router.
 *
 * Handles custom domain configuration and DNS verification for brands.
 * Custom domains enable GS1-compliant QR codes for digital product passports.
 *
 * Targets:
 * - brand.customDomains.get - Get the brand's custom domain (if any)
 * - brand.customDomains.add - Add a new custom domain (generates verification token)
 * - brand.customDomains.verify - Trigger DNS verification check
 * - brand.customDomains.remove - Remove the custom domain
 */
import { eq } from "@v1/db/queries";
import { brandCustomDomains } from "@v1/db/schema";
import { ROLES } from "../../../config/roles.js";
import { customDomainAddSchema } from "../../../schemas/custom-domains.js";
import {
  buildDnsInstructions,
  generateVerificationToken,
  verifyDomainDns,
} from "../../../utils/dns-verification.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";

// ============================================================================
// Procedures
// ============================================================================

/**
 * Get the brand's custom domain configuration.
 *
 * Returns null if no domain is configured.
 * All brand members can read the domain configuration.
 */
const getProcedure = brandRequiredProcedure.query(async ({ ctx }) => {
  const { db, brandId } = ctx;

  try {
    const [domain] = await db
      .select()
      .from(brandCustomDomains)
      .where(eq(brandCustomDomains.brandId, brandId))
      .limit(1);

    if (!domain) {
      return { domain: null };
    }

    return {
      domain: {
        id: domain.id,
        domain: domain.domain,
        status: domain.status as "pending" | "verified" | "failed",
        verificationToken: domain.verificationToken,
        verificationError: domain.verificationError,
        verifiedAt: domain.verifiedAt,
        createdAt: domain.createdAt,
      },
    };
  } catch (error) {
    throw wrapError(error, "Failed to fetch custom domain");
  }
});

/**
 * Add a new custom domain for the brand.
 *
 * Generates a verification token and stores the domain with 'pending' status.
 * Returns DNS instructions for the user to configure their DNS records.
 *
 * Only brand owners can add domains.
 */
const addProcedure = brandRequiredProcedure
  .use(hasRole([ROLES.OWNER]))
  .input(customDomainAddSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    const { domain } = input;

    try {
      // Check if brand already has a domain configured
      const [existing] = await db
        .select({ id: brandCustomDomains.id })
        .from(brandCustomDomains)
        .where(eq(brandCustomDomains.brandId, brandId))
        .limit(1);

      if (existing) {
        throw badRequest(
          "You already have a custom domain configured. Remove it first to add a new one.",
        );
      }

      // Check if domain is already claimed by another brand
      const [claimed] = await db
        .select({ id: brandCustomDomains.id })
        .from(brandCustomDomains)
        .where(eq(brandCustomDomains.domain, domain))
        .limit(1);

      if (claimed) {
        throw badRequest("This domain is already in use by another brand.");
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();

      // Insert the new domain record
      const [newDomain] = await db
        .insert(brandCustomDomains)
        .values({
          brandId,
          domain,
          status: "pending",
          verificationToken,
        })
        .returning();

      if (!newDomain) {
        throw badRequest("Failed to create custom domain record.");
      }

      // Build DNS instructions
      const dnsInstructions = buildDnsInstructions(domain, verificationToken);

      return {
        id: newDomain.id,
        domain: newDomain.domain,
        status: "pending" as const,
        verificationToken: newDomain.verificationToken,
        dnsInstructions,
      };
    } catch (error) {
      throw wrapError(error, "Failed to add custom domain");
    }
  });

/**
 * Trigger DNS verification for the brand's pending domain.
 *
 * Performs a DNS TXT lookup to verify domain ownership.
 * Updates the domain status to 'verified' or 'failed'.
 *
 * Only brand owners can verify domains.
 */
const verifyProcedure = brandRequiredProcedure
  .use(hasRole([ROLES.OWNER]))
  .mutation(async ({ ctx }) => {
    const { db, brandId } = ctx;

    try {
      // Get the brand's current domain
      const [domain] = await db
        .select()
        .from(brandCustomDomains)
        .where(eq(brandCustomDomains.brandId, brandId))
        .limit(1);

      if (!domain) {
        throw badRequest("No custom domain is configured for your brand.");
      }

      if (domain.status === "verified") {
        throw badRequest("Your domain is already verified.");
      }

      // Perform DNS verification
      const result = await verifyDomainDns(
        domain.domain,
        domain.verificationToken,
      );

      const now = new Date().toISOString();

      if (result.success) {
        // Update to verified status
        await db
          .update(brandCustomDomains)
          .set({
            status: "verified",
            verifiedAt: now,
            lastVerificationAttempt: now,
            verificationError: null,
            updatedAt: now,
          })
          .where(eq(brandCustomDomains.id, domain.id));

        return {
          success: true,
          status: "verified" as const,
          verifiedAt: now,
        };
      }

      // Update to failed status with error message
      await db
        .update(brandCustomDomains)
        .set({
          status: "failed",
          lastVerificationAttempt: now,
          verificationError: result.error ?? "Verification failed",
          updatedAt: now,
        })
        .where(eq(brandCustomDomains.id, domain.id));

      return {
        success: false,
        status: "failed" as const,
        error: result.error,
      };
    } catch (error) {
      throw wrapError(error, "Failed to verify domain");
    }
  });

/**
 * Remove the brand's custom domain.
 *
 * Performs a hard delete, allowing the domain to be reclaimed.
 *
 * Only brand owners can remove domains.
 */
const removeProcedure = brandRequiredProcedure
  .use(hasRole([ROLES.OWNER]))
  .mutation(async ({ ctx }) => {
    const { db, brandId } = ctx;

    try {
      // Check if domain exists
      const [domain] = await db
        .select({ id: brandCustomDomains.id })
        .from(brandCustomDomains)
        .where(eq(brandCustomDomains.brandId, brandId))
        .limit(1);

      if (!domain) {
        throw badRequest("No custom domain is configured for your brand.");
      }

      // Delete the domain
      await db
        .delete(brandCustomDomains)
        .where(eq(brandCustomDomains.id, domain.id));

      return { success: true };
    } catch (error) {
      throw wrapError(error, "Failed to remove custom domain");
    }
  });

// ============================================================================
// Router Export
// ============================================================================

export const brandCustomDomainsRouter = createTRPCRouter({
  get: getProcedure,
  add: addProcedure,
  verify: verifyProcedure,
  remove: removeProcedure,
});

type BrandCustomDomainsRouter = typeof brandCustomDomainsRouter;
