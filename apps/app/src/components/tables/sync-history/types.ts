// Sync history table domain types

export type SyncJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type TriggerType = "scheduled" | "manual" | "webhook";

export const SYNC_STATUS_LABELS: Record<SyncJobStatus, string> = {
  pending: "Pending",
  running: "Syncing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  scheduled: "Scheduled",
  manual: "Manual",
  webhook: "Webhook",
};

export interface SyncJobRow {
  id: string;
  brandIntegrationId: string;
  status: SyncJobStatus;
  triggerType: TriggerType;
  startedAt: string | null;
  finishedAt: string | null;
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  productsFailed: number;
  productsSkipped: number;
  entitiesCreated: number;
  errorSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
