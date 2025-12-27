/**
 * Bulk staging operations - backward compatibility shim.
 * 
 * This file re-exports all staging functions from the organized
 * bulk/staging/ directory structure. The actual implementations have been
 * split into:
 * - bulk/staging/insert.ts - Insert operations
 * - bulk/staging/preview.ts - Preview and query operations
 * - bulk/staging/commit.ts - Commit operations
 * - bulk/staging/cleanup.ts - Cleanup operations
 * 
 * @deprecated Import directly from bulk/staging/ submodules for better tree-shaking.
 */
export * from "./staging/index";
