"use server";

interface ProgressPayload {
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

const DEFAULT_API_URL = "http://localhost:4000";
const DEFAULT_INTERNAL_API_KEY = "dev-internal-key";

/**
 * Lightweight helper that batches progress updates and forwards them
 * to the API's internal emitProgress endpoint for WebSocket fan-out.
 */
export class ProgressEmitter {
  private pendingUpdate: ProgressPayload | null = null;
  private lastEmitTime = 0;
  private readonly EMIT_INTERVAL_MS = 1000;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
    this.apiKey = process.env.INTERNAL_API_KEY || DEFAULT_INTERNAL_API_KEY;
  }

  emit(params: ProgressPayload): void {
    const now = Date.now();
    const timeSinceLastEmit = now - this.lastEmitTime;
    this.pendingUpdate = params;

    if (timeSinceLastEmit >= this.EMIT_INTERVAL_MS) {
      this.lastEmitTime = now;
      void this.sendUpdate(params);
    }
  }

  async flush(): Promise<void> {
    if (this.pendingUpdate) {
      await this.sendUpdate(this.pendingUpdate);
      this.pendingUpdate = null;
    }
  }

  private async sendUpdate(params: ProgressPayload): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiUrl}/trpc/internal.emitProgress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: {
              apiKey: this.apiKey,
              ...params,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("[ProgressEmitter] Failed to emit progress", {
          status: response.status,
          jobId: params.jobId,
          error: errorText.substring(0, 200),
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ProgressEmitter] Network error", {
          jobId: params.jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
