/**
 * WebSocket Manager for real-time bulk import progress updates.
 *
 * Manages WebSocket connections, handles JWT authentication, emits progress
 * events, and provides connection cleanup for bulk import jobs.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";
import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";

/**
 * Progress update event payload sent to connected clients
 */
export interface ProgressUpdate {
  jobId: string;
  status:
    | "PENDING"
    | "VALIDATING"
    | "VALIDATED"
    | "COMMITTING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  phase: "validation" | "commit";
  processed: number;
  total: number;
  created?: number;
  updated?: number;
  failed?: number;
  percentage: number;
  message?: string;
}

/**
 * WebSocket connection metadata
 */
interface ConnectionMetadata {
  ws: WebSocket;
  jobId: string;
  userId: string;
  brandId: string;
  subscriptionId: string;
  lastHeartbeat: number;
}

/**
 * Manages WebSocket connections for real-time import progress updates.
 *
 * Provides connection lifecycle management, JWT authentication, job-specific
 * subscriptions, heartbeat monitoring, and automatic cleanup.
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, Set<ConnectionMetadata>>();
  private connectionsBySocket = new WeakMap<WebSocket, ConnectionMetadata>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT_MS = 60000; // 60 seconds

  /**
   * Initialize the WebSocket server and attach to HTTP server
   *
   * @param server - HTTP server to attach WebSocket server to
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle upgrade requests
    server.on("upgrade", async (request, socket, head) => {
      if (request.url?.startsWith("/ws/import-progress")) {
        await this.handleUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    });

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    console.log("WebSocket server initialized for import progress updates");
  }

  /**
   * Handle WebSocket upgrade requests with authentication
   */
  private async handleUpgrade(
    request: IncomingMessage,
    socket: unknown,
    head: Buffer,
  ): Promise<void> {
    try {
      // Extract JWT from query params
      const url = new URL(
        request.url || "",
        `http://${request.headers.host || "localhost"}`,
      );
      const token = url.searchParams.get("token");

      if (!token) {
        (socket as { destroy: () => void }).destroy();
        return;
      }

      // Verify JWT and get user
      const authResult = await this.authenticateToken(token);
      if (!authResult) {
        (socket as { destroy: () => void }).destroy();
        return;
      }

      const { user, brandId } = authResult;

      // Complete WebSocket handshake
      this.wss?.handleUpgrade(request, socket as never, head, (ws) => {
        this.wss?.emit("connection", ws, request, user, brandId);
        this.handleConnection(ws, user, brandId);
      });
    } catch (error) {
      console.error("WebSocket upgrade error:", error);
      (socket as { destroy: () => void }).destroy();
    }
  }

  /**
   * Authenticate JWT token and extract user information
   */
  private async authenticateToken(
    token: string,
  ): Promise<{ user: User; brandId: string } | null> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase configuration missing");
        return null;
      }

      const supabase: SupabaseClient<Database> = createSupabaseClient(
        supabaseUrl,
        supabaseAnonKey,
      );

      // Verify token and get user
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.error("Token verification failed:", error);
        return null;
      }

      // Get user's brand ID from database
      const { data: userData } = await supabase
        .from("users")
        .select("brand_id")
        .eq("id", user.id)
        .single();

      if (!userData?.brand_id) {
        console.error("User has no brand association");
        return null;
      }

      return { user, brandId: userData.brand_id };
    } catch (error) {
      console.error("Authentication error:", error);
      return null;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, user: User, brandId: string): void {
    console.log(`WebSocket connected: user=${user.id}, brand=${brandId}`);

    // Set up message handler for subscription requests
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as {
          action: string;
          jobId?: string;
        };

        if (message.action === "subscribe" && message.jobId) {
          this.subscribe(message.jobId, ws, user.id, brandId);
        } else if (message.action === "unsubscribe" && message.jobId) {
          this.unsubscribe(message.jobId, ws);
        } else if (message.action === "ping") {
          // Update heartbeat timestamp
          const metadata = this.connectionsBySocket.get(ws);
          if (metadata) {
            metadata.lastHeartbeat = Date.now();
            ws.send(JSON.stringify({ type: "pong" }));
          }
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      console.log(`WebSocket disconnected: user=${user.id}`);
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.handleDisconnection(ws);
    });
  }

  /**
   * Subscribe a WebSocket connection to a specific job's progress updates
   *
   * @param jobId - Import job ID to subscribe to
   * @param ws - WebSocket connection
   * @param userId - User ID for authorization
   * @param brandId - Brand ID for authorization
   */
  subscribe(
    jobId: string,
    ws: WebSocket,
    userId: string,
    brandId: string,
  ): void {
    const subscriptionId = `${jobId}-${userId}-${Date.now()}`;

    const metadata: ConnectionMetadata = {
      ws,
      jobId,
      userId,
      brandId,
      subscriptionId,
      lastHeartbeat: Date.now(),
    };

    // Add to job-specific connections
    if (!this.connections.has(jobId)) {
      this.connections.set(jobId, new Set());
    }
    this.connections.get(jobId)?.add(metadata);

    // Store metadata for quick lookup
    this.connectionsBySocket.set(ws, metadata);

    console.log(`Subscribed to job ${jobId}: subscription=${subscriptionId}`);

    // Send subscription confirmation
    ws.send(
      JSON.stringify({
        type: "subscribed",
        jobId,
        subscriptionId,
      }),
    );
  }

  /**
   * Unsubscribe a WebSocket connection from a job
   *
   * @param jobId - Import job ID to unsubscribe from
   * @param ws - WebSocket connection
   */
  unsubscribe(jobId: string, ws: WebSocket): void {
    const metadata = this.connectionsBySocket.get(ws);
    if (!metadata) return;

    const jobConnections = this.connections.get(jobId);
    if (jobConnections) {
      jobConnections.delete(metadata);
      if (jobConnections.size === 0) {
        this.connections.delete(jobId);
      }
    }

    console.log(`Unsubscribed from job ${jobId}: user=${metadata.userId}`);

    ws.send(
      JSON.stringify({
        type: "unsubscribed",
        jobId,
      }),
    );
  }

  /**
   * Handle WebSocket disconnection and cleanup
   *
   * @param ws - WebSocket connection that disconnected
   */
  private handleDisconnection(ws: WebSocket): void {
    const metadata = this.connectionsBySocket.get(ws);
    if (!metadata) return;

    const { jobId } = metadata;

    // Remove from job-specific connections
    const jobConnections = this.connections.get(jobId);
    if (jobConnections) {
      jobConnections.delete(metadata);
      if (jobConnections.size === 0) {
        this.connections.delete(jobId);
      }
    }

    // Clean up metadata
    this.connectionsBySocket.delete(ws);

    console.log(`Connection cleaned up: job=${jobId}, user=${metadata.userId}`);
  }

  /**
   * Emit progress update to all subscribers of a job
   *
   * @param jobId - Import job ID
   * @param data - Progress update data
   */
  emit(jobId: string, data: ProgressUpdate): void {
    const jobConnections = this.connections.get(jobId);

    if (!jobConnections || jobConnections.size === 0) {
      console.log(`No active connections for job ${jobId}`);
      return;
    }

    const message = JSON.stringify({
      type: "progress",
      data,
    });

    let successCount = 0;
    let failureCount = 0;

    for (const metadata of jobConnections) {
      try {
        if (metadata.ws.readyState === WebSocket.OPEN) {
          metadata.ws.send(message);
          successCount++;
        } else {
          // Remove stale connection
          this.handleDisconnection(metadata.ws);
          failureCount++;
        }
      } catch (error) {
        console.error(
          `Failed to send to connection ${metadata.subscriptionId}:`,
          error,
        );
        failureCount++;
      }
    }

    console.log(
      `Emitted progress for job ${jobId}: ${successCount} sent, ${failureCount} failed`,
    );
  }

  /**
   * Start heartbeat monitoring to detect stale connections
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [jobId, jobConnections] of this.connections.entries()) {
        for (const metadata of jobConnections) {
          // Check if connection exceeded timeout
          if (now - metadata.lastHeartbeat > this.CONNECTION_TIMEOUT_MS) {
            console.log(
              `Connection timeout: job=${jobId}, user=${metadata.userId}`,
            );
            metadata.ws.close();
            this.handleDisconnection(metadata.ws);
          } else if (metadata.ws.readyState === WebSocket.OPEN) {
            // Send ping to active connections
            try {
              metadata.ws.send(JSON.stringify({ type: "ping" }));
            } catch (error) {
              console.error("Failed to send heartbeat:", error);
              this.handleDisconnection(metadata.ws);
            }
          }
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Clean up connections for a completed job
   *
   * @param jobId - Import job ID to clean up
   */
  cleanupJob(jobId: string): void {
    const jobConnections = this.connections.get(jobId);

    if (!jobConnections) {
      return;
    }

    console.log(
      `Cleaning up ${jobConnections.size} connections for job ${jobId}`,
    );

    for (const metadata of jobConnections) {
      try {
        // Send completion notification before closing
        metadata.ws.send(
          JSON.stringify({
            type: "job_completed",
            jobId,
          }),
        );

        // Close connection gracefully
        metadata.ws.close();
      } catch (error) {
        console.error(`Failed to close connection: ${error}`);
      }
    }

    this.connections.delete(jobId);
  }

  /**
   * Get count of active connections for a job
   *
   * @param jobId - Import job ID
   * @returns Number of active connections
   */
  getConnectionCount(jobId: string): number {
    return this.connections.get(jobId)?.size ?? 0;
  }

  /**
   * Shutdown WebSocket server and cleanup all connections
   */
  shutdown(): void {
    console.log("Shutting down WebSocket server...");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    for (const [jobId] of this.connections) {
      this.cleanupJob(jobId);
    }

    // Close WebSocket server
    this.wss?.close(() => {
      console.log("WebSocket server closed");
    });
  }
}

/**
 * Singleton instance of WebSocket manager
 */
export const websocketManager = new WebSocketManager();
