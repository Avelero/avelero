/**
 * Bulk Import Testing Utilities
 *
 * Provides utilities for testing bulk import functionality:
 * - Excel file generation
 * - Mock storage
 * - Mock Trigger.dev tasks
 * - Product fixtures
 *
 * For database-dependent utilities (TestDatabase, TestCatalog),
 * use @v1/db/testing instead.
 *
 * @module @v1/testing/bulk-import
 */

// Excel file generation
export * from "./excel-builder";

// Mock utilities (no database dependency)
export * from "./mock-storage";
export * from "./mock-trigger";

// Static fixtures (no database dependency)
export * from "./fixtures/product-fixtures";
