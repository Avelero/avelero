/**
 * Integration components for managing external system connections.
 *
 * @module components/integrations
 */

export {
  IntegrationCard,
  IntegrationCardSkeleton,
} from "./integration-card";
export {
  IntegrationDetail,
  IntegrationDetailSkeleton,
} from "./integration-detail";
export { IntegrationsList } from "./integrations-list";
export { IntegrationLogo } from "./integration-logo";

export { SetupWizard } from "./setup-wizard";
export {
  FieldSection,
  FieldSectionSkeleton,
  type FieldRowData,
} from "./field-section";
export {
  IntegrationStatusBadge,
  PrimaryBadge,
  SyncProgressBlock,
  IntegrationInfoRow,
  formatSyncTime,
  formatFullDateTime,
  formatDuration,
  type IntegrationStatus,
  type SyncJobStatus,
  type JobType,
  type MatchIdentifier,
} from "./integration-status";
export {
  FIELD_GROUP_LABELS,
  FIELD_GROUP_ORDER,
  HIDDEN_FIELDS,
  getFieldGroup,
  getFieldUIInfo,
  type FieldGroup,
} from "./field-config";

// Re-export modal for convenience
export { ConnectIntegrationModal } from "@/components/modals/connect-integration-modal";
