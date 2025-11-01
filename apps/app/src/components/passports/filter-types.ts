/**
 * Filter Types for Passport Table Filtering
 *
 * This file contains all TypeScript type definitions for the filtering system.
 * Supports both quick filters (Tier 1) and advanced filters with nested logic.
 */

// ============================================================================
// Input Types
// ============================================================================

export type FilterInputType =
  | "text" // Simple text input
  | "number" // Numeric input
  | "percentage" // Percentage input (0-100)
  | "boolean" // Boolean toggle
  | "select" // Single select dropdown
  | "multi-select" // Multiple selection with checkboxes
  | "date" // Date picker
  | "date-relative" // Relative date (last 7 days, etc.)
  | "country" // Country selector
  | "module-picker" // Module completion picker
  | "hierarchical" // Hierarchical select (e.g., categories with parent/child)
  | "nested"; // Nested conditions (e.g., materials, facilities)

// ============================================================================
// Operator Types
// ============================================================================

export type TextOperator =
  | "contains"
  | "does not contain"
  | "is"
  | "is not"
  | "starts with"
  | "ends with"
  | "is empty"
  | "is not empty";

export type NumberOperator = "equals" | "does not equal" | "greater than" | "greater than or equal to" | "less than" | "less than or equal to" | "between";

export type MultiSelectOperator =
  | "is any of"
  | "is none of"
  | "is empty"
  | "is not empty";

export type DateOperator =
  | "is"
  | "is before"
  | "is after"
  | "is on or before"
  | "is on or after"
  | "is between"
  | "relative";

export type BooleanOperator = "is true" | "is false";

export type ModuleCompletionOperator = "is complete" | "is not complete";

export type FilterOperator =
  | TextOperator
  | NumberOperator
  | MultiSelectOperator
  | DateOperator
  | BooleanOperator
  | ModuleCompletionOperator;

// ============================================================================
// Relative Date Types
// ============================================================================

export type RelativeDateOption =
  | "today"
  | "yesterday"
  | "last 7 days"
  | "last 30 days"
  | "this month"
  | "last month"
  | "this quarter"
  | "this year"
  | "more than X days ago";

// ============================================================================
// Filter Field Configuration
// ============================================================================

export interface FilterFieldConfig {
  id: string;
  label: string;
  tier: 1 | 2 | 3; // Quick (1), Advanced (2), Power User (3)
  category:
    | "product"
    | "sustainability"
    | "variants"
    | "manufacturing"
    | "metadata";
  inputType: FilterInputType;
  operators: FilterOperator[];
  options?: SelectOption[]; // Static options
  optionsSource?: {
    // Dynamic options from tRPC
    type: "trpc";
    endpoint: string; // e.g., "brand.colors.list"
    transform?: (data: any) => SelectOption[];
  };
  unit?: string; // Display unit (kg, L, %)
  placeholder?: string;
  description?: string;
  nested?: {
    // For nested input types (materials, facilities)
    type: string;
    primaryField: string;
    nestedFields: string[];
  };
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

// ============================================================================
// Filter Condition & State
// ============================================================================

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value: FilterValue;
  nestedConditions?: FilterCondition[]; // For Materials/Facilities WHERE clauses
}

export interface FilterGroup {
  id: string;
  conditions: FilterCondition[]; // OR logic within group
  // UI-only flag: when true, render as a visible group container even if only one condition
  asGroup?: boolean;
}

export interface FilterState {
  groups: FilterGroup[]; // AND logic between groups
}

// ============================================================================
// Filter Values
// ============================================================================

export type FilterValue =
  | string // text, select
  | number // number, percentage
  | boolean // boolean
  | string[] // multi-select
  | DateValue // date
  | RelativeDateValue // relative date
  | NumberRangeValue // between operator
  | DateRangeValue // date range
  | null
  | undefined;

export interface DateValue {
  date: string; // ISO date string
}

export interface RelativeDateValue {
  type: "relative";
  option: RelativeDateOption;
  customDays?: number; // For "more than X days ago"
}

export interface NumberRangeValue {
  min?: number;
  max?: number;
}

export interface DateRangeValue {
  after?: string; // ISO date string - on or after this date
  before?: string; // ISO date string - on or before this date
}

// ============================================================================
// Filter Actions
// ============================================================================

export interface FilterActions {
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<FilterGroup>) => void;
  addCondition: (groupId: string, initial?: Partial<FilterCondition>) => void;
  updateCondition: (
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>,
  ) => void;
  removeCondition: (groupId: string, conditionId: string) => void;
  clearAll: () => void;
  setGroups: (groups: FilterGroup[]) => void;
}

// ============================================================================
// Query Builder Types (for future backend integration)
// ============================================================================

export interface PassportFilterQuery {
  groups: QueryGroup[];
  groupOperator: "AND";
}

export interface QueryGroup {
  operator: "OR";
  conditions: QueryCondition[];
}

export interface QueryCondition {
  field: string;
  operator: string;
  value: any;
  nested?: QueryCondition[];
}

// ============================================================================
// UI Component Props
// ============================================================================

export interface FilterRowProps {
  groupId: string;
  condition: FilterCondition;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
  availableFields: FilterFieldConfig[];
  isNested?: boolean;
}

export interface FilterGroupProps {
  group: FilterGroup;
  onAddCondition: () => void;
  onUpdateCondition: (
    conditionId: string,
    updates: Partial<FilterCondition>,
  ) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRemoveGroup: () => void;
  availableFields: FilterFieldConfig[];
}

export interface QuickFiltersPopoverProps {
  filterState: FilterState;
  filterActions: FilterActions;
  onOpenAdvanced: () => void;
}

export interface AdvancedFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterState: FilterState;
  filterActions: FilterActions;
}
