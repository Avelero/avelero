// Types — canonical definitions live in @v1/dpp-components/types/editor
export type {
  StyleFieldType,
  StyleField,
  ContentFieldType,
  ContentField,
  SectionVisibilityKey,
  ComponentDefinition,
} from "@v1/dpp-components";

// Constants
export {
  TYPESCALE_OPTIONS,
  CAPITALIZATION_OPTIONS,
  FLEX_DIRECTION_OPTIONS,
  ALIGN_ITEMS_OPTIONS,
  JUSTIFY_CONTENT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
} from "./constants";

// Utility functions
export {
  hasEditableContent,
  hasConfigContent,
  resolveComponentForEditor,
} from "./utils";
