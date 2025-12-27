import "./configure-trigger";

// Import and export all tasks so Trigger.dev bundles & registers them
// NOTE: Invite tasks temporarily disabled due to email template .tsx loading issues
// export { inviteBrandMembers } from "./invite";
export { cleanupExpiredInvites } from "./cleanup-expired-invites";
export { validateAndStage } from "./bulk/validate-and-stage";
export { commitToProduction } from "./bulk/commit-to-production";
export { captureThemeScreenshot } from "./capture-theme-screenshot";
export { deleteBrand } from "./delete-brand";

// Integration sync tasks
export { syncIntegration, integrationSyncScheduler } from "./integrations";
