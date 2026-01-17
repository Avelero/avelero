/**
 * Test Database Utilities
 *
 * Comprehensive test utilities for database operations.
 * This module provides all the tools needed for testing database-dependent code.
 *
 * @module @v1/db/testing
 */

// Core utilities
export { testDb, closeTestDb, type TestDatabaseConnection } from "./connection";
export { cleanupTables, protectedTables } from "./cleanup";

// Brand and integration helpers
export {
  createTestBrand,
  createTestBrandIntegration,
  createDefaultFieldConfigs,
} from "./brand";

// User helpers
export { createTestUser } from "./user";

// Sync context helpers
export {
  createTestSyncContext,
  createFieldConfigs,
  type SyncContext,
  type FieldConfig,
  type CreateSyncContextOptions,
} from "./context";

// Export test helpers
export {
  createTestProductForExport,
  createTestVariantWithOverrides,
  createTestExportJob,
  type CreateTestProductForExportOptions,
  type CreateTestVariantWithOverridesOptions,
  type CreateTestExportJobOptions,
} from "./export";

// Bulk import helpers
export {
  TestCatalog,
  TestDatabase,
  type TestCatalogOptions,
  type InsertedCatalog,
  type DbTestProduct,
  type DbTestVariant,
  type DbTestImportJob,
  type CatalogFixtures,
  createFullCatalogFixtures,
  createMinimalCatalogFixtures,
  createEmptyCatalogFixtures,
  createAttributeValueFixtures,
} from "./bulk-import";
