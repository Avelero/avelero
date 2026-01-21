/**
 * Integration management router.
 *
 * Combines all integration sub-routers into a single namespace:
 * - connections: Connect, disconnect, and manage integrations
 * - mappings: Configure field ownership and source mappings
 * - sync: Trigger syncs and view history
 *
 * @module trpc/routers/integrations
 */
import { createTRPCRouter } from "../../init.js";
import { connectionsRouter } from "./connections.js";
import { mappingsRouter } from "./mappings.js";
import { promotionRouter } from "./promotion.js";
import { syncRouter } from "./sync.js";

/**
 * Main integrations router exposing all integration management endpoints.
 *
 * Structure:
 * - integrations.connections.* (list, get, getBySlug, connect, disconnect, update, testConnection)
 * - integrations.mappings.* (list, update, updateBatch, listAllOwnerships)
 * - integrations.sync.* (trigger, history, status, getJob)
 *
 * Total: 12 endpoints across 3 sub-routers
 */
export const integrationsRouter = createTRPCRouter({
  /**
   * Connection management sub-router.
   *
   * Powers the integration connection workflow:
   * - Browse available integrations
   * - Connect/disconnect integrations
   * - Test credentials
   */
  connections: connectionsRouter,

  /**
   * Field mapping configuration sub-router.
   *
   * Powers the field ownership UI:
   * - View/edit field mappings
   * - Detect ownership conflicts
   */
  mappings: mappingsRouter,

  /**
   * Sync operations sub-router.
   *
   * Powers the sync monitoring UI:
   * - Manually trigger syncs
   * - View sync history and status
   */
  sync: syncRouter,

  /**
   * Promotion operations sub-router.
   *
   * Powers the promotion status UI:
   * - Poll for promotion operation progress
   */
  promotion: promotionRouter,
});

type IntegrationsRouter = typeof integrationsRouter;
