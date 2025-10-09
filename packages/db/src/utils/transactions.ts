import type { Database } from "../client.js";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/**
 * Transaction Management for Multi-Module Operations
 *
 * Provides utilities for operations that span multiple modules, ensuring data consistency
 * and proper rollback mechanisms across module boundaries.
 */

// Type for transaction context - same as Database but in transaction mode
// Note: Using any to bypass TypeScript's strict enum checking in schema
export type TransactionContext = any;

// Base interface for transaction operations
export interface TransactionOperation<T = any> {
  name: string;
  execute: (tx: TransactionContext) => Promise<T>;
  rollback?: (tx: TransactionContext, data?: T) => Promise<void>;
}

// Transaction execution result
export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  operations: string[];
  rollbacks: string[];
}

// Transaction configuration
export interface TransactionConfig {
  timeout?: number; // Timeout in milliseconds (default: 30s)
  isolation?:
    | "read uncommitted"
    | "read committed"
    | "repeatable read"
    | "serializable";
  maxRetries?: number; // For serialization failures (default: 3)
  retryDelay?: number; // Delay between retries in ms (default: 100)
}

// Default transaction configuration
const DEFAULT_CONFIG: Required<TransactionConfig> = {
  timeout: 30000, // 30 seconds
  isolation: "read committed",
  maxRetries: 3,
  retryDelay: 100,
};

/**
 * Execute multiple operations within a single transaction
 * Provides automatic rollback on failure and retry logic for serialization errors
 */
export async function executeTransaction<T = any>(
  db: Database,
  operations: TransactionOperation[],
  config: TransactionConfig = {},
): Promise<TransactionResult<T[]>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let attempt = 0;

  while (attempt <= finalConfig.maxRetries) {
    try {
      const result = await db.transaction(
        async (tx) => {
          const executedOperations: string[] = [];
          const results: T[] = [];

          // Set transaction timeout if specified
          if (finalConfig.timeout > 0) {
            await tx.execute(
              `SET statement_timeout = '${finalConfig.timeout}ms'`,
            );
          }

          // Set isolation level if specified
          if (finalConfig.isolation !== "read committed") {
            await tx.execute(
              `SET TRANSACTION ISOLATION LEVEL ${finalConfig.isolation.toUpperCase()}`,
            );
          }

          try {
            // Execute operations sequentially
            for (const operation of operations) {
              const operationResult = await operation.execute(tx as any);
              results.push(operationResult);
              executedOperations.push(operation.name);
            }

            return {
              success: true,
              data: results,
              operations: executedOperations,
              rollbacks: [],
            };
          } catch (error) {
            // Auto-rollback via transaction boundary
            throw error;
          }
        },
        {
          // Transaction options
          accessMode: "read write",
        },
      );

      return result;
    } catch (error: any) {
      attempt++;

      // Check if it's a serialization failure that can be retried
      if (error.code === "40001" && attempt <= finalConfig.maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            finalConfig.retryDelay * Math.pow(2, attempt - 1),
          ),
        );
        continue;
      }

      // Non-retryable error or max retries exceeded
      return {
        success: false,
        error: error.message || "Transaction failed",
        operations: [],
        rollbacks: [],
      };
    }
  }

  return {
    success: false,
    error: "Max retries exceeded",
    operations: [],
    rollbacks: [],
  };
}

/**
 * Execute operations with manual rollback capabilities
 * Useful for complex operations that need custom cleanup logic
 */
export async function executeTransactionWithRollback<T = any>(
  db: Database,
  operations: TransactionOperation<T>[],
  config: TransactionConfig = {},
): Promise<TransactionResult<T[]>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let attempt = 0;

  while (attempt <= finalConfig.maxRetries) {
    try {
      const result = await db.transaction(async (tx) => {
        const executedOperations: {
          name: string;
          result: T;
          operation: TransactionOperation<T>;
        }[] = [];
        const rollbacks: string[] = [];

        // Set transaction configuration
        if (finalConfig.timeout > 0) {
          await tx.execute(
            `SET statement_timeout = '${finalConfig.timeout}ms'`,
          );
        }

        if (finalConfig.isolation !== "read committed") {
          await tx.execute(
            `SET TRANSACTION ISOLATION LEVEL ${finalConfig.isolation.toUpperCase()}`,
          );
        }

        try {
          // Execute operations sequentially
          for (const operation of operations) {
            const operationResult = await operation.execute(tx as any);
            executedOperations.push({
              name: operation.name,
              result: operationResult,
              operation,
            });
          }

          return {
            success: true,
            data: executedOperations.map((e) => e.result),
            operations: executedOperations.map((e) => e.name),
            rollbacks,
          };
        } catch (error) {
          // Execute rollbacks in reverse order
          for (let i = executedOperations.length - 1; i >= 0; i--) {
            const executedOp = executedOperations[i];
            if (!executedOp) continue;
            const { name, result, operation } = executedOp;
            if (operation.rollback) {
              try {
                await operation.rollback(tx as any, result);
                rollbacks.push(`${name}:rollback`);
              } catch (rollbackError) {
                // Log rollback error but continue with transaction rollback
                console.error(
                  `Rollback failed for operation ${name}:`,
                  rollbackError,
                );
              }
            }
          }

          throw error; // Re-throw to trigger transaction rollback
        }
      });

      return result;
    } catch (error: any) {
      attempt++;

      // Retry logic for serialization failures
      if (error.code === "40001" && attempt <= finalConfig.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            finalConfig.retryDelay * Math.pow(2, attempt - 1),
          ),
        );
        continue;
      }

      return {
        success: false,
        error: error.message || "Transaction failed",
        operations: [],
        rollbacks: [],
      };
    }
  }

  return {
    success: false,
    error: "Max retries exceeded",
    operations: [],
    rollbacks: [],
  };
}

/**
 * Create a simple transaction operation
 */
export function createOperation<T>(
  name: string,
  execute: (tx: TransactionContext) => Promise<T>,
  rollback?: (tx: TransactionContext, data?: T) => Promise<void>,
): TransactionOperation<T> {
  return { name, execute, rollback };
}

/**
 * Create a validation operation that doesn't modify data
 */
export function createValidationOperation<T>(
  name: string,
  validate: (tx: TransactionContext) => Promise<T>,
): TransactionOperation<T> {
  return createOperation(name, validate);
}

/**
 * Create a data operation with automatic conflict detection
 */
export function createDataOperation<T>(
  name: string,
  execute: (tx: TransactionContext) => Promise<T>,
  conflictCheck?: (tx: TransactionContext) => Promise<boolean>,
): TransactionOperation<T> {
  return createOperation(name, async (tx) => {
    // Check for conflicts before execution
    if (conflictCheck) {
      const hasConflict = await conflictCheck(tx);
      if (hasConflict) {
        throw new Error(`Conflict detected for operation: ${name}`);
      }
    }

    return execute(tx);
  });
}

// Type helper for extracting table relations
type ExtractTablesWithRelations<T> = T extends Record<string, any> ? T : never;
