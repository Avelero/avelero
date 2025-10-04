import { z } from "zod";
import { pgEnum } from "drizzle-orm/pg-core";

// ================================
// PostgreSQL Enum Definitions
// ================================

/**
 * Entity status enum for general state management
 * Covers lifecycle states from draft to archived/deleted
 */
export const entityStatusPgEnum = pgEnum("entity_status", [
  "draft",
  "active",
  "inactive",
  "published",
  "pending",
  "archived",
  "cancelled",
  "deferred",
  "blocked",
]);

/**
 * Priority levels for tasks, issues, and importance ranking
 */
export const priorityPgEnum = pgEnum("priority_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * User roles within brand/organization context
 */
export const userRolePgEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

/**
 * Permission types for access control
 */
export const permissionTypePgEnum = pgEnum("permission_type", [
  "read",
  "write",
  "delete",
  "manage",
  "admin",
]);

/**
 * Job/Process status for background operations
 */
export const jobStatusPgEnum = pgEnum("job_status", [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "retrying",
]);

/**
 * Data source types for tracking origin of data
 */
export const dataSourceTypePgEnum = pgEnum("data_source_type", [
  "manual",
  "import",
  "api",
  "bulk",
  "migration",
  "sync",
  "webhook",
]);

/**
 * Validation result severity levels
 */
export const validationSeverityPgEnum = pgEnum("validation_severity", [
  "info",
  "success",
  "warning",
  "error",
  "critical",
]);

/**
 * Environment types for deployment contexts
 */
export const environmentPgEnum = pgEnum("environment_type", [
  "development",
  "testing",
  "staging",
  "production",
]);

/**
 * Sort direction for ordering queries
 */
export const sortDirectionPgEnum = pgEnum("sort_direction", [
  "asc",
  "desc",
]);

/**
 * Content visibility levels
 */
export const visibilityPgEnum = pgEnum("visibility_level", [
  "private",
  "internal",
  "public",
  "restricted",
]);

// ================================
// Zod Schema Definitions
// ================================

/**
 * Entity status enum with comprehensive state coverage
 */
export const entityStatusEnum = z.enum([
  "draft",
  "active",
  "inactive",
  "published",
  "pending",
  "archived",
  "cancelled",
  "deferred",
  "blocked",
]);

/**
 * Priority levels enum
 */
export const priorityEnum = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * User roles enum for brand context
 */
export const userRoleEnum = z.enum([
  "owner",
  "admin",
  "member",
  "viewer",
]);

/**
 * Permission types enum
 */
export const permissionTypeEnum = z.enum([
  "read",
  "write",
  "delete",
  "manage",
  "admin",
]);

/**
 * Job status enum for background processes
 */
export const jobStatusEnum = z.enum([
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "retrying",
]);

/**
 * Data source type enum
 */
export const dataSourceTypeEnum = z.enum([
  "manual",
  "import",
  "api",
  "bulk",
  "migration",
  "sync",
  "webhook",
]);

/**
 * Validation severity enum
 */
export const validationSeverityEnum = z.enum([
  "info",
  "success",
  "warning",
  "error",
  "critical",
]);

/**
 * Environment type enum
 */
export const environmentEnum = z.enum([
  "development",
  "testing",
  "staging",
  "production",
]);

/**
 * Sort direction enum
 */
export const sortDirectionEnum = z.enum([
  "asc",
  "desc",
]);

/**
 * Visibility level enum
 */
export const visibilityEnum = z.enum([
  "private",
  "internal",
  "public",
  "restricted",
]);

// ================================
// Type Exports
// ================================

export type EntityStatus = z.infer<typeof entityStatusEnum>;
export type Priority = z.infer<typeof priorityEnum>;
export type UserRole = z.infer<typeof userRoleEnum>;
export type PermissionType = z.infer<typeof permissionTypeEnum>;
export type JobStatus = z.infer<typeof jobStatusEnum>;
export type DataSourceType = z.infer<typeof dataSourceTypeEnum>;
export type ValidationSeverity = z.infer<typeof validationSeverityEnum>;
export type Environment = z.infer<typeof environmentEnum>;
export type SortDirection = z.infer<typeof sortDirectionEnum>;
export type Visibility = z.infer<typeof visibilityEnum>;

// ================================
// Enum Display Labels
// ================================

/**
 * Human-readable labels for entity status values
 */
export const entityStatusLabels: Record<EntityStatus, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
  published: "Published",
  pending: "Pending",
  archived: "Archived",
  cancelled: "Cancelled",
  deferred: "Deferred",
  blocked: "Blocked",
} as const;

/**
 * Human-readable labels for priority values
 */
export const priorityLabels: Record<Priority, string> = {
  low: "Low Priority",
  medium: "Medium Priority",
  high: "High Priority",
  critical: "Critical Priority",
} as const;

/**
 * Human-readable labels for user roles
 */
export const userRoleLabels: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  member: "Member",
  viewer: "Viewer",
} as const;

/**
 * Human-readable labels for permission types
 */
export const permissionTypeLabels: Record<PermissionType, string> = {
  read: "Read Access",
  write: "Write Access",
  delete: "Delete Access",
  manage: "Manage Access",
  admin: "Admin Access",
} as const;

/**
 * Human-readable labels for job status
 */
export const jobStatusLabels: Record<JobStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  timeout: "Timed Out",
  retrying: "Retrying",
} as const;

/**
 * Human-readable labels for data source types
 */
export const dataSourceTypeLabels: Record<DataSourceType, string> = {
  manual: "Manual Entry",
  import: "File Import",
  api: "API Integration",
  bulk: "Bulk Operation",
  migration: "Data Migration",
  sync: "Data Sync",
  webhook: "Webhook",
} as const;

/**
 * Human-readable labels for validation severity
 */
export const validationSeverityLabels: Record<ValidationSeverity, string> = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
  critical: "Critical Error",
} as const;

/**
 * Human-readable labels for environment types
 */
export const environmentLabels: Record<Environment, string> = {
  development: "Development",
  testing: "Testing",
  staging: "Staging",
  production: "Production",
} as const;

/**
 * Human-readable labels for sort directions
 */
export const sortDirectionLabels: Record<SortDirection, string> = {
  asc: "Ascending",
  desc: "Descending",
} as const;

/**
 * Human-readable labels for visibility levels
 */
export const visibilityLabels: Record<Visibility, string> = {
  private: "Private",
  internal: "Internal",
  public: "Public",
  restricted: "Restricted",
} as const;

// ================================
// Enum Color/Style Mappings
// ================================

/**
 * CSS color classes for entity status (Tailwind-compatible)
 */
export const entityStatusColors: Record<EntityStatus, string> = {
  draft: "text-gray-600 bg-gray-100",
  active: "text-green-700 bg-green-100",
  inactive: "text-gray-500 bg-gray-50",
  published: "text-blue-700 bg-blue-100",
  pending: "text-yellow-700 bg-yellow-100",
  archived: "text-gray-400 bg-gray-50",
  cancelled: "text-red-600 bg-red-100",
  deferred: "text-orange-600 bg-orange-100",
  blocked: "text-red-700 bg-red-200",
} as const;

/**
 * CSS color classes for priority levels
 */
export const priorityColors: Record<Priority, string> = {
  low: "text-green-600 bg-green-50",
  medium: "text-yellow-600 bg-yellow-50",
  high: "text-orange-600 bg-orange-50",
  critical: "text-red-700 bg-red-100",
} as const;

/**
 * CSS color classes for validation severity
 */
export const validationSeverityColors: Record<ValidationSeverity, string> = {
  info: "text-blue-600 bg-blue-50",
  success: "text-green-600 bg-green-50",
  warning: "text-yellow-600 bg-yellow-50",
  error: "text-red-600 bg-red-50",
  critical: "text-red-800 bg-red-100",
} as const;

// ================================
// Enum Ordering/Sorting
// ================================

/**
 * Sort order for entity status (workflow progression)
 */
export const entityStatusOrder: Record<EntityStatus, number> = {
  draft: 1,
  pending: 2,
  active: 3,
  published: 4,
  inactive: 5,
  deferred: 6,
  blocked: 7,
  cancelled: 8,
  archived: 9,
} as const;

/**
 * Sort order for priority levels (ascending importance)
 */
export const priorityOrder: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

/**
 * Sort order for user roles (ascending privileges)
 */
export const userRoleOrder: Record<UserRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
} as const;

/**
 * Sort order for validation severity (ascending severity)
 */
export const validationSeverityOrder: Record<ValidationSeverity, number> = {
  info: 1,
  success: 2,
  warning: 3,
  error: 4,
  critical: 5,
} as const;