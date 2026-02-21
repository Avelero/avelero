import { availableParallelism, cpus } from "node:os";
import { Worker } from "node:worker_threads";
import type { GenerateQrPngOptions } from "./qr-export";
import { generateQrPng } from "./qr-export";

const DEFAULT_MAX_WORKERS = 6;

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
    const worker = new Worker(WORKER_SOURCE, { eval: true });
    const slot: WorkerSlot = { worker, currentTaskId: null };

    worker.on("message", (message: WorkerResponse) => {
      this.handleMessage(slot, message);
    });

    worker.on("error", (error) => {
      this.failActiveTask(slot, error);
      this.failAllQueued(
        new Error(
          `QR worker thread ${index} crashed: ${error.message || "Unknown worker error"}`,
        ),
      );
    });

    worker.on("exit", (code) => {
      if (!this.disposed && code !== 0) {
        this.failActiveTask(
          slot,
          new Error(`QR worker thread ${index} exited with code ${code}`),
        );
        this.failAllQueued(
          new Error(
            `QR worker thread ${index} exited unexpectedly with code ${code}`,
          ),
        );
      }
    });

    return slot;
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
      slot.worker.postMessage({
        id: task.id,
        data: task.data,
        options: task.options,
      });
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
