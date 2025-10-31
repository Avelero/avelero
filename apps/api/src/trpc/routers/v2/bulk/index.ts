/**
 * Bulk operations router scaffold.
 *
 * Targets:
 * - bulk.import
 * - bulk.update
 */
import { brandRequiredProcedure, createTRPCRouter } from "../../../init.js";

const bulkMutation = brandRequiredProcedure.mutation(async () => {
  throw new Error("bulk operation not implemented yet");
});

export const bulkRouter = createTRPCRouter({
  import: bulkMutation,
  update: bulkMutation,
});

export type BulkRouter = typeof bulkRouter;
