"use client";

import { createClient } from "@v1/supabase/client";
import { useCallback, useEffect, useRef } from "react";

/**
 * Progress update event from WebSocket server
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
 * Options for the useImportWebSocket hook
 */
export interface UseImportWebSocketOptions {
  jobId: string | null;
  onProgress: (update: ProgressUpdate) => void;
  enabled: boolean;
}

/**
 * Hook to connect to WebSocket server for real-time import progress updates
 *
 * Features:
 * - JWT authentication
 * - Automatic reconnection on disconnect
 * - Heartbeat/ping-pong to keep connection alive
 * - Automatic subscription management
 *
 * @param options - Configuration options
 * @returns Connection status
 */
export function useImportWebSocket({
  jobId,
  onProgress,
  enabled,
}: UseImportWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(async () => {
    if (!jobId || !enabled) {
      console.log("[WS] Not connecting: jobId or enabled is false");
      return;
    }

    // Clear any existing reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      // Get JWT token from Supabase
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("[WS] No auth token available");
        return;
      }

      // Construct WebSocket URL from API URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100";
      const wsUrl = apiUrl.replace(/^http/, "ws");
      const wsEndpoint = `${wsUrl}/ws/import-progress?token=${session.access_token}`;

      console.log(
        "[WS] Connecting to:",
        wsEndpoint.replace(session.access_token, "***"),
      );

      const ws = new WebSocket(wsEndpoint);

      ws.onopen = () => {
        console.log("[WS] Connected successfully");
        reconnectAttemptsRef.current = 0; // Reset reconnection counter

        // Subscribe to job updates
        ws.send(
          JSON.stringify({
            action: "subscribe",
            jobId,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case "progress":
              // Forward progress update to callback
              onProgress(message.data);
              break;

            case "subscribed":
              console.log("[WS] Subscribed to job:", message.jobId);
              break;

            case "unsubscribed":
              console.log("[WS] Unsubscribed from job:", message.jobId);
              break;

            case "ping":
              // Respond to server ping
              ws.send(JSON.stringify({ action: "ping" }));
              break;

            case "pong":
              // Server acknowledged our ping
              break;

            case "job_completed":
              console.log("[WS] Job completed notification:", message.jobId);
              break;

            default:
              console.log("[WS] Unknown message type:", message.type);
          }
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Connection error:", error);
      };

      ws.onclose = (event) => {
        console.log("[WS] Connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });

        // Capture current enabled state to avoid stale closure
        const shouldReconnect = enabled && jobId;

        // Attempt to reconnect if still enabled and not at max attempts
        if (shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(
            1000 * 2 ** reconnectAttemptsRef.current,
            30000,
          ); // Exponential backoff, max 30s

          console.log(
            `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
          );

          reconnectTimerRef.current = setTimeout(() => {
            // Re-check enabled state before reconnecting
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error("[WS] Max reconnection attempts reached. Giving up.");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[WS] Error establishing connection:", error);

      // Capture current enabled state to avoid stale closure
      const shouldReconnect = enabled && jobId;

      // Attempt reconnect on error
      if (shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);

        reconnectTimerRef.current = setTimeout(() => {
          // Re-check enabled state before reconnecting
          connect();
        }, delay);
      }
    }
  }, [jobId, enabled, onProgress]);

  // Cleanup function
  const disconnect = useCallback(() => {
    console.log("[WS] Disconnecting...");

    // Clear reconnection timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      // Unsubscribe before closing
      if (wsRef.current.readyState === WebSocket.OPEN && jobId) {
        wsRef.current.send(
          JSON.stringify({
            action: "unsubscribe",
            jobId,
          }),
        );
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
  }, [jobId]);

  // Connect when enabled and jobId is available
  useEffect(() => {
    if (enabled && jobId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled, jobId]);

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    disconnect,
  };
}
