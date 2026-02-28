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
import { createTRPCRouter } from "../../init.js";
import { exportRouter } from "./export.js";
import { importRouter } from "./import.js";
import { qrExportRouter } from "./qr-export.js";
import { valuesRouter } from "./values.js";

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
