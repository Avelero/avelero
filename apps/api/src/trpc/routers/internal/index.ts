/**
 * Internal router for server-to-server communication.
 *
 * Used by background jobs (Trigger.dev) to communicate with the API server.
 * These endpoints should NOT be exposed to clients and should be protected
 * by an internal API key.
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../init.js";
import { websocketManager } from "../../../lib/websocket-manager.js";
import { badRequest } from "../../../utils/errors.js";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "dev-internal-key";

/**
 * Progress update schema matching WebSocket ProgressUpdate interface
 */
const emitProgressSchema = z.object({
  apiKey: z.string(),
  jobId: z.string(),
  status: z.enum([
    "PENDING",
    "VALIDATING",
    "VALIDATED",
    "COMMITTING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ]),
  phase: z.enum(["validation", "commit"]),
  processed: z.number(),
  total: z.number(),
  created: z.number().optional(),
  updated: z.number().optional(),
  failed: z.number().optional(),
  percentage: z.number(),
  message: z.string().optional(),
});

export const internalRouter = createTRPCRouter({
  /**
   * Emit progress update to WebSocket clients
   *
   * Called by background jobs to push real-time updates to connected clients.
   */
  emitProgress: publicProcedure
    .input(emitProgressSchema)
    .mutation(async ({ input }) => {
      // Verify internal API key
      if (input.apiKey !== INTERNAL_API_KEY) {
        throw badRequest("Invalid internal API key");
      }

      // Extract progress data (remove apiKey)
      const { apiKey, ...progressData } = input;

      // Emit to WebSocket clients
      websocketManager.emit(input.jobId, progressData);

      console.log("[internal.emitProgress] Progress emitted to WebSocket clients", {
        jobId: input.jobId,
        status: input.status,
        connectionCount: websocketManager.getConnectionCount(input.jobId),
      });

      return {
        success: true,
        emittedTo: websocketManager.getConnectionCount(input.jobId),
      };
    }),

  /**
   * Cleanup job connections
   *
   * Called when a job is completed to clean up WebSocket connections.
   */
  cleanupJob: publicProcedure
    .input(
      z.object({
        apiKey: z.string(),
        jobId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      // Verify internal API key
      if (input.apiKey !== INTERNAL_API_KEY) {
        throw badRequest("Invalid internal API key");
      }

      websocketManager.cleanupJob(input.jobId);

      console.log("[internal.cleanupJob] Cleaned up connections for job", {
        jobId: input.jobId,
      });

      return {
        success: true,
      };
    }),
});

export type InternalRouter = typeof internalRouter;
