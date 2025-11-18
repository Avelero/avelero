/**
 * Bulk operations router implementation.
 *
 * Structure:
 * - import.*: Async bulk import lifecycle (validate, start, status, approve, cancel)
 * - staging.*: Staging data operations (preview, errors, export)
 * - values.*: Value mapping operations (unmapped, define, batchDefine)
 * - import (legacy): Synchronous product import (deprecated)
 * - update: Passport bulk updates
 */
import { badRequest } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { importRouter } from "./import.js";
import { stagingRouter } from "./staging.js";
import { valuesRouter } from "./values.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrand(
  ctx: AuthenticatedTRPCContext,
): asserts ctx is BrandContext {
  if (!ctx.brandId) {
    throw badRequest("Active brand context required");
  }
}

function assertBrandScope(
  ctx: AuthenticatedTRPCContext,
  requestedBrandId?: string | null,
): string {
  ensureBrand(ctx);
  const activeBrandId = ctx.brandId;
  if (requestedBrandId && requestedBrandId !== activeBrandId) {
    throw badRequest("Active brand does not match the requested brand_id");
  }
  return activeBrandId;
}

/**
 * Main bulk operations router with nested routers
 */
export const bulkRouter = createTRPCRouter({
  /**
   * Nested routers for async bulk import operations
   */
  import: importRouter,
  staging: stagingRouter,
  values: valuesRouter,
});

export type BulkRouter = typeof bulkRouter;
