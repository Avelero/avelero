/**
 * Promotion operations router.
 *
 * Handles promotion status polling for the frontend.
 * The actual promotion trigger is in connections.ts as promoteToPrimary.
 *
 * @module trpc/routers/integrations/promotion
 */
import { getPromotionStatusByIntegration } from "@v1/db/queries/integrations";
import { getPromotionStatusSchema } from "../../../schemas/integrations.js";
import { wrapError } from "../../../utils/errors.js";
import { createEntityResponse } from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandReadProcedure, createTRPCRouter } from "../../init.js";

/** tRPC context with guaranteed brand ID from middleware */
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Promotion sub-router for promotion status tracking.
 *
 * Endpoints:
 * - status: Get current promotion operation status for a brand integration
 */
export const promotionRouter = createTRPCRouter({
  /**
   * Get current promotion operation status for a brand integration.
   *
   * Used by the frontend to poll for promotion progress.
   * Returns the most recent promotion operation for the integration.
   */
  status: brandReadProcedure
    .input(getPromotionStatusSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const operation = await getPromotionStatusByIntegration(
          brandCtx.db,
          input.brand_integration_id,
        );
        return createEntityResponse(operation ?? null);
      } catch (error) {
        throw wrapError(error, "Failed to get promotion status");
      }
    }),
});

type PromotionRouter = typeof promotionRouter;
