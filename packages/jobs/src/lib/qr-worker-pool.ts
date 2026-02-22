import { availableParallelism, cpus } from "node:os";
import { Worker } from "node:worker_threads";
import type { GenerateQrPngOptions } from "./qr-export";
import { generateQrPng } from "./qr-export";

const DEFAULT_MAX_WORKERS = 6;

// SECURITY: Keep this worker source static and hardcoded. Never interpolate
// runtime/user input because it is executed with `eval: true`.
const WORKER_SOURCE = `
  const { parentPort } = require("node:worker_threads");
  const QRCode = require("qrcode");

  if (!parentPort) {
    throw new Error("Worker parent port is unavailable");
  }

  parentPort.on("message", async (message) => {
    const { id, data, options } = message;
    try {
      const buffer = await QRCode.toBuffer(data, {
        type: "png",
        width: options?.width,
        margin: options?.margin,
        errorCorrectionLevel: options?.errorCorrectionLevel,
      });

      const bytes = new Uint8Array(buffer);
      parentPort.postMessage({ id, success: true, bytes }, [bytes.buffer]);
    } catch (error) {
      parentPort.postMessage({
        id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
`;

function createWorkerThread(): Worker {
  return new Worker(WORKER_SOURCE, { eval: true });
}

type WorkerResponse =
  | { id: number; success: true; bytes: Uint8Array }
  | { id: number; success: false; error: string };

interface QueueTask {
  id: number;
  data: string;
  options: GenerateQrPngOptions;
  resolve: (buffer: Buffer) => void;
  reject: (error: Error) => void;
}

interface WorkerSlot {
  index: number;
  worker: Worker;
  currentTaskId: number | null;
}

export interface QrPngGenerator {
  mode: "worker_threads" | "main_thread";
  workerCount: number;
  generate(data: string, options?: GenerateQrPngOptions): Promise<Buffer>;
  dispose(): Promise<void>;
}

class MainThreadQrPngGenerator implements QrPngGenerator {
  readonly mode = "main_thread" as const;
  readonly workerCount = 1;

  generate(data: string, options: GenerateQrPngOptions = {}): Promise<Buffer> {
    return generateQrPng(data, options);
  }

  async dispose(): Promise<void> {
    // No-op: no workers to terminate.
  }
}

class WorkerThreadQrPngGenerator implements QrPngGenerator {
  readonly mode = "worker_threads" as const;
  readonly workerCount: number;

  private slots: WorkerSlot[];
  private pendingTasks = new Map<number, QueueTask>();
  private queue: QueueTask[] = [];
  private nextTaskId = 1;
  private disposed = false;

  constructor(workerCount: number) {
    this.workerCount = workerCount;
    this.slots = Array.from({ length: workerCount }, (_, index) =>
      this.createSlot(index),
    );
  }

  generate(data: string, options: GenerateQrPngOptions = {}): Promise<Buffer> {
    if (this.disposed) {
      return Promise.reject(new Error("QR worker pool is already disposed"));
    }
    if (this.slots.length === 0) {
      return Promise.reject(new Error("QR worker pool has no active workers"));
    }

    return new Promise<Buffer>((resolve, reject) => {
      const task: QueueTask = {
        id: this.nextTaskId++,
        data,
        options,
        resolve,
        reject,
      };
      this.queue.push(task);
      this.dispatch();
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    const error = new Error("QR worker pool disposed before completing tasks");
    while (this.queue.length > 0) {
      const queued = this.queue.shift();
      queued?.reject(error);
    }
    for (const pending of this.pendingTasks.values()) {
      pending.reject(error);
    }
    this.pendingTasks.clear();

    await Promise.all(this.slots.map((slot) => slot.worker.terminate()));
    this.slots = [];
  }

  private createSlot(index: number): WorkerSlot {
    const slot: WorkerSlot = {
      index,
      worker: createWorkerThread(),
      currentTaskId: null,
    };
    this.bindWorkerEvents(slot, slot.worker);
    return slot;
  }

  private bindWorkerEvents(slot: WorkerSlot, worker: Worker): void {
    worker.on("message", (message: WorkerResponse) => {
      if (slot.worker !== worker) {
        return;
      }

      this.handleMessage(slot, message);
    });

    worker.on("error", (error) => {
      if (slot.worker !== worker) {
        return;
      }

      this.handleWorkerFailure(
        slot,
        new Error(
          `QR worker thread ${slot.index} crashed: ${error.message || "Unknown worker error"}`,
        ),
      );
    });

    worker.on("exit", (code) => {
      if (slot.worker !== worker || this.disposed) {
        return;
      }

      this.handleWorkerFailure(
        slot,
        new Error(
          `QR worker thread ${slot.index} exited unexpectedly with code ${code}`,
        ),
      );
    });
  }

  private handleWorkerFailure(slot: WorkerSlot, error: Error): void {
    this.failActiveTask(slot, error);
    if (this.disposed) {
      return;
    }

    try {
      const replacement = createWorkerThread();
      slot.worker = replacement;
      this.bindWorkerEvents(slot, replacement);
      this.dispatch();
      return;
    } catch {
      // Replacement failed; drop this slot and continue with remaining workers.
    }

    this.removeSlot(slot);
    if (this.slots.length === 0) {
      this.failAllQueued(
        new Error(
          "All QR worker threads are unavailable and queued QR tasks cannot continue",
        ),
      );
      return;
    }
    this.dispatch();
  }

  private removeSlot(slot: WorkerSlot): void {
    const index = this.slots.indexOf(slot);
    if (index >= 0) {
      this.slots.splice(index, 1);
    }
  }

  private handleMessage(slot: WorkerSlot, message: WorkerResponse): void {
    const task = this.pendingTasks.get(message.id);
    if (!task) {
      return;
    }

    this.pendingTasks.delete(message.id);
    slot.currentTaskId = null;

    if (message.success) {
      task.resolve(Buffer.from(message.bytes));
    } else {
      task.reject(new Error(message.error));
    }

    this.dispatch();
  }

  private failActiveTask(slot: WorkerSlot, error: Error): void {
    if (!slot.currentTaskId) {
      return;
    }
    const task = this.pendingTasks.get(slot.currentTaskId);
    if (task) {
      this.pendingTasks.delete(slot.currentTaskId);
      task.reject(error);
    }
    slot.currentTaskId = null;
  }

  private failAllQueued(error: Error): void {
    while (this.queue.length > 0) {
      const queued = this.queue.shift();
      queued?.reject(error);
    }
  }

  private dispatch(): void {
    if (this.disposed) {
      return;
    }

    for (const slot of this.slots) {
      if (slot.currentTaskId !== null) {
        continue;
      }

      const task = this.queue.shift();
      if (!task) {
        return;
      }

      slot.currentTaskId = task.id;
      this.pendingTasks.set(task.id, task);
      try {
        slot.worker.postMessage({
          id: task.id,
          data: task.data,
          options: task.options,
        });
      } catch (error) {
        this.pendingTasks.delete(task.id);
        slot.currentTaskId = null;
        this.queue.unshift(task);
        this.handleWorkerFailure(
          slot,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }
}

function getCpuCount(): number {
  return typeof availableParallelism === "function"
    ? availableParallelism()
    : cpus().length;
}

function normalizeWorkerCount(maxWorkers?: number): number {
  const cpuCount = Math.max(1, getCpuCount());
  const defaultTarget = Math.max(
    1,
    Math.min(DEFAULT_MAX_WORKERS, cpuCount - 1),
  );
  if (!maxWorkers || Number.isNaN(maxWorkers)) {
    return defaultTarget;
  }
  return Math.max(1, Math.min(maxWorkers, cpuCount));
}

export function createQrPngGenerator(maxWorkers?: number): QrPngGenerator {
  const workerCount = normalizeWorkerCount(maxWorkers);
  if (workerCount <= 1) {
    return new MainThreadQrPngGenerator();
  }

  try {
    return new WorkerThreadQrPngGenerator(workerCount);
  } catch {
    return new MainThreadQrPngGenerator();
  }
}
