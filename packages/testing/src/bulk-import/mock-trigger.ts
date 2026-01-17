/**
 * Mock Trigger.dev Utility for Bulk Import Tests
 *
 * Provides mock implementations for Trigger.dev task execution.
 * Allows testing job workflows without actually running background tasks.
 *
 * @module @v1/testing/bulk-import/mock-trigger
 */

// ============================================================================
// Types
// ============================================================================

export interface MockTriggerOptions {
  /** Task names that should fail when triggered */
  failTasks?: string[];
  /** Delay in ms before task "completes" */
  delayMs?: number;
  /** Custom task handlers */
  handlers?: Map<string, (payload: unknown) => Promise<unknown>>;
}

export interface TriggeredTask {
  name: string;
  payload: unknown;
  triggeredAt: Date;
  runId: string;
}

export interface TaskRun {
  id: string;
  taskIdentifier: string;
  status: "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED";
  output?: unknown;
  error?: string;
}

// ============================================================================
// Mock State
// ============================================================================

/** All tasks that have been triggered */
const triggeredTasks: TriggeredTask[] = [];

/** Task run results */
const taskRuns = new Map<string, TaskRun>();

/** Tasks configured to fail */
const failingTasks = new Set<string>();

/** Custom task handlers */
const taskHandlers = new Map<string, (payload: unknown) => Promise<unknown>>();

/** Simulated delay */
let taskDelayMs = 0;

/** Run ID counter */
let runIdCounter = 0;

// ============================================================================
// Mock Trigger Class
// ============================================================================

/**
 * Mock Trigger.dev utility for testing background task execution.
 *
 * @example
 * ```typescript
 * // Setup mock trigger
 * MockTrigger.setup();
 *
 * // Trigger a task (in your code under test)
 * await validateAndStageTask.trigger({ jobId: "123" });
 *
 * // Verify the task was triggered
 * const tasks = MockTrigger.getTriggeredTasks();
 * expect(tasks).toHaveLength(1);
 * expect(tasks[0].name).toBe("validate-and-stage");
 *
 * // Cleanup
 * MockTrigger.clear();
 * ```
 */
export class MockTrigger {
  /**
   * Initialize mock trigger with optional configuration
   */
  static setup(options?: MockTriggerOptions): void {
    // Clear existing state
    MockTrigger.clear();

    // Configure failing tasks
    if (options?.failTasks) {
      for (const taskName of options.failTasks) {
        failingTasks.add(taskName);
      }
    }

    // Set delay
    taskDelayMs = options?.delayMs ?? 0;

    // Set custom handlers
    if (options?.handlers) {
      for (const [name, handler] of options.handlers) {
        taskHandlers.set(name, handler);
      }
    }
  }

  /**
   * Record a task trigger and return a mock run result
   */
  static async trigger(
    taskName: string,
    payload: unknown,
  ): Promise<{ id: string }> {
    // Generate run ID
    const runId = `mock-run-${++runIdCounter}`;

    // Record the trigger
    triggeredTasks.push({
      name: taskName,
      payload,
      triggeredAt: new Date(),
      runId,
    });

    // Create initial task run record
    taskRuns.set(runId, {
      id: runId,
      taskIdentifier: taskName,
      status: "PENDING",
    });

    // Simulate async execution
    if (taskDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, taskDelayMs));
    }

    // Update status based on configuration
    if (failingTasks.has(taskName)) {
      taskRuns.set(runId, {
        id: runId,
        taskIdentifier: taskName,
        status: "FAILED",
        error: `Mock failure for task: ${taskName}`,
      });
    } else if (taskHandlers.has(taskName)) {
      // Run custom handler
      try {
        const handler = taskHandlers.get(taskName)!;
        const output = await handler(payload);
        taskRuns.set(runId, {
          id: runId,
          taskIdentifier: taskName,
          status: "COMPLETED",
          output,
        });
      } catch (error) {
        taskRuns.set(runId, {
          id: runId,
          taskIdentifier: taskName,
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      // Default: task completes successfully
      taskRuns.set(runId, {
        id: runId,
        taskIdentifier: taskName,
        status: "COMPLETED",
      });
    }

    return { id: runId };
  }

  /**
   * Simulate triggering a task and waiting for it to complete
   */
  static async triggerAndWait<T = unknown>(
    taskName: string,
    payload: unknown,
  ): Promise<{ id: string; output: T | undefined }> {
    const { id } = await MockTrigger.trigger(taskName, payload);
    const run = taskRuns.get(id);

    if (run?.status === "FAILED") {
      throw new Error(run.error ?? "Task failed");
    }

    return { id, output: run?.output as T | undefined };
  }

  /**
   * Get all tasks that have been triggered
   */
  static getTriggeredTasks(): TriggeredTask[] {
    return [...triggeredTasks];
  }

  /**
   * Get tasks triggered with a specific name
   */
  static getTriggeredTasksByName(taskName: string): TriggeredTask[] {
    return triggeredTasks.filter((t) => t.name === taskName);
  }

  /**
   * Get the most recent task triggered with a specific name
   */
  static getLastTriggeredTask(taskName: string): TriggeredTask | undefined {
    const tasks = MockTrigger.getTriggeredTasksByName(taskName);
    return tasks[tasks.length - 1];
  }

  /**
   * Get a task run by ID
   */
  static getTaskRun(runId: string): TaskRun | undefined {
    return taskRuns.get(runId);
  }

  /**
   * Configure a task to fail when triggered
   */
  static setTaskToFail(taskName: string): void {
    failingTasks.add(taskName);
  }

  /**
   * Remove a task from the failing list
   */
  static setTaskToSucceed(taskName: string): void {
    failingTasks.delete(taskName);
  }

  /**
   * Register a custom handler for a task
   */
  static registerHandler(
    taskName: string,
    handler: (payload: unknown) => Promise<unknown>,
  ): void {
    taskHandlers.set(taskName, handler);
  }

  /**
   * Clear all mock trigger state
   */
  static clear(): void {
    triggeredTasks.length = 0;
    taskRuns.clear();
    failingTasks.clear();
    taskHandlers.clear();
    taskDelayMs = 0;
    runIdCounter = 0;
  }

  /**
   * Get the total number of tasks triggered
   */
  static getTriggerCount(): number {
    return triggeredTasks.length;
  }

  /**
   * Check if a specific task was triggered
   */
  static wasTriggered(taskName: string): boolean {
    return triggeredTasks.some((t) => t.name === taskName);
  }

  /**
   * Get the number of times a specific task was triggered
   */
  static getTaskTriggerCount(taskName: string): number {
    return triggeredTasks.filter((t) => t.name === taskName).length;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock task object for testing.
 * This can be used to replace actual Trigger.dev task imports in tests.
 *
 * @example
 * ```typescript
 * const mockTask = createMockTask("validate-and-stage");
 * await mockTask.trigger({ jobId: "123" });
 * expect(MockTrigger.wasTriggered("validate-and-stage")).toBe(true);
 * ```
 */
export function createMockTask(taskName: string) {
  return {
    trigger: async (payload: unknown) => {
      return MockTrigger.trigger(taskName, payload);
    },
    triggerAndWait: async <T = unknown>(payload: unknown) => {
      return MockTrigger.triggerAndWait<T>(taskName, payload);
    },
  };
}

/**
 * Create mock task definitions for all bulk import tasks
 */
export function createMockImportTasks() {
  return {
    validateAndStage: createMockTask("validate-and-stage"),
    commitToProduction: createMockTask("commit-to-production"),
    generateCorrectionFile: createMockTask("generate-correction-file"),
  };
}
