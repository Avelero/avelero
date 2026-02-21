/**
 * Bulk operations router implementation.
 *
 * Structure:
 * - import.*: Async bulk import lifecycle (validate, start, status, approve, cancel)
 * - export.*: Async bulk export lifecycle (start, status)
 * - values.*: Value mapping operations (unmapped, define, batchDefine)
 *
 * Note: Staging router has been removed as staging tables were replaced with
 * import_rows.normalized JSONB data structure.
 */
import { badRequest } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { exportRouter } from "./export.js";
import { importRouter } from "./import.js";
import { qrExportRouter } from "./qr-export.js";
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
   * Nested routers for async bulk operations
   */
  import: importRouter,
  export: exportRouter,
  qrExport: qrExportRouter,
  values: valuesRouter,
});

type BulkRouter = typeof bulkRouter;
