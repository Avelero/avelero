/**
 * Integration components for managing external system connections.
 *
 * @module components/integrations
 */

export {
  AvailableIntegrationCard,
  ConnectedIntegrationCard,
  EmptyIntegrationsState,
  IntegrationCardSkeleton,
} from "./integration-card";
export { IntegrationDetail } from "./integration-detail";
export { IntegrationsList } from "./integrations-list";
export { FieldSetup } from "./field-setup";

// Re-export table components for convenience
export { FieldMappingTable, FieldMappingHeader } from "@/components/tables/field-mappings";
export {
  SyncHistoryTable,
  SyncStats,
  SyncStatusBadge,
  IntegrationStatusBadge,
  formatSyncTime,
  formatDuration,
} from "@/components/tables/sync-history";

// Re-export modal for convenience
export { ConnectIntegrationModal } from "@/components/modals/connect-integration-modal";
