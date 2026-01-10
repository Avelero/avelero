/**
 * Bulk Import Testing Utilities
 *
 * Provides utilities for testing the bulk import functionality:
 * - ExcelBuilder: Create test Excel files programmatically
 * - MockStorage: Mock Supabase storage for file operations
 * - MockTrigger: Mock Trigger.dev for background task testing
 * - TestCatalog: Setup brand catalog data for tests
 * - TestDatabase: Database helpers for verifying import results
 * - Test fixtures: Reusable test data
 *
 * @module @v1/testing/bulk-import
 */

export * from "./excel-builder";
export * from "./mock-storage";
export * from "./mock-trigger";
export * from "./test-catalog";
export * from "./test-database";
export * from "./fixtures/catalog-fixtures";
export * from "./fixtures/product-fixtures";
