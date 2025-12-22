/**
 * @v1/integrations - Integration System
 *
 * This package provides the complete integration system for Avelero,
 * including connectors, sync engine, and UI helpers.
 *
 * Submodule exports:
 * - @v1/integrations/connectors - Connector schemas, clients, and registry
 * - @v1/integrations/sync - Sync engine and types
 * - @v1/integrations/ui - Client-safe exports for UI components
 *
 * @see plan-integration.md for architecture details
 */

// Connectors
export * from "./connectors/index";

// Sync engine
export * from "./sync/index";

// UI helpers
export * from "./ui/index";
