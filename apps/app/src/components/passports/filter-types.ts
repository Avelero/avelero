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
  | "text"                    // Simple text input
  | "number"                  // Numeric input
  | "percentage"              // Percentage input (0-100)
  | "boolean"                 // Boolean toggle
  | "select"                  // Single select dropdown
  | "multi-select"            // Multiple selection with checkboxes
  | "date"                    // Date picker
  | "date-relative"           // Relative date (last 7 days, etc.)
  | "hierarchical"            // Tree select for categories
  | "nested"                  // Nested filter (Materials, Facilities)
  | "country"                 // Country selector
  | "module-picker";          // Module completion picker

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

export type NumberOperator =
  | "="
  | "≠"
  | ">"
  | "≥"
  | "<"
  | "≤"
  | "between";

export type MultiSelectOperator =
  | "is any of"
  | "is none of"
  | "is empty"
  | "is not empty";

export type RelationalOperator =
  | "contains any of"
  | "contains all of"
  | "does not contain"
  | "is empty"
  | "is not empty";

export type HierarchicalOperator =
  | "is"
  | "is not"
  | "is any of"
  | "is descendant of"
  | "is ancestor of";

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
  | RelationalOperator
  | HierarchicalOperator
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

export interface NestedFilterConfig {
  type: "materials" | "facilities";
  primaryField: string;         // Field to select (e.g., "brandMaterialId")
  nestedFields: string[];        // Fields available in WHERE conditions
}

export interface FilterFieldConfig {
  id: string;
  label: string;
  tier: 1 | 2 | 3;              // Quick (1), Advanced (2), Power User (3)
  category: "product" | "sustainability" | "variants" | "manufacturing" | "metadata";
  inputType: FilterInputType;
  operators: FilterOperator[];
  options?: SelectOption[];      // Static options
  optionsSource?: {              // Dynamic options from tRPC
    type: "trpc";
    endpoint: string;            // e.g., "brandCatalog.colors.list"
    transform?: (data: any) => SelectOption[];
  };
  nested?: NestedFilterConfig;   // For nested filters
  unit?: string;                 // Display unit (kg, L, %)
  placeholder?: string;
  description?: string;
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
  nestedConditions?: FilterCondition[];  // For Materials/Facilities WHERE clauses
}

export interface FilterGroup {
  id: string;
  conditions: FilterCondition[];  // OR logic within group
}

export interface FilterState {
  groups: FilterGroup[];  // AND logic between groups
}

// ============================================================================
// Filter Values
// ============================================================================

export type FilterValue =
  | string                          // text, select
  | number                          // number, percentage
  | boolean                         // boolean
  | string[]                        // multi-select, relational
  | DateValue                       // date
  | RelativeDateValue               // relative date
  | NumberRangeValue                // between operator
  | DateRangeValue                  // date range
  | NestedFilterValue               // nested (materials/facilities)
  | null
  | undefined;

export interface DateValue {
  date: string;  // ISO date string
}

export interface RelativeDateValue {
  type: "relative";
  option: RelativeDateOption;
  customDays?: number;  // For "more than X days ago"
}

export interface NumberRangeValue {
  min: number;
  max: number;
}

export interface DateRangeValue {
  start: string;  // ISO date string
  end: string;    // ISO date string
}

export interface NestedFilterValue {
  primarySelection: string | string[];  // Selected material/facility IDs
  whereConditions?: FilterCondition[];  // Nested filter conditions
}

// ============================================================================
// Filter Actions
// ============================================================================

export interface FilterActions {
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  addCondition: (groupId: string, initial?: Partial<FilterCondition>) => void;
  updateCondition: (
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>
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
  onUpdateCondition: (conditionId: string, updates: Partial<FilterCondition>) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRemoveGroup: () => void;
  availableFields: FilterFieldConfig[];
}

export interface FilterValueInputProps {
  fieldConfig: FilterFieldConfig;
  operator: FilterOperator;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

export interface NestedFilterInputProps {
  fieldConfig: FilterFieldConfig;
  value: NestedFilterValue | null | undefined;
  onChange: (value: NestedFilterValue) => void;
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

