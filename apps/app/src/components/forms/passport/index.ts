/**
 * Passport Forms
 *
 * Consolidated exports for all passport form components including:
 * - Product forms (create/edit)
 * - Variant forms
 * - Sidebars, skeletons, and actions
 */

// Main form components
export { CreateProductForm, EditProductForm } from "./product-form";
export {
  VariantForm,
  EditVariantForm,
  CreateVariantForm,
} from "./variant-form";

// Action components
export {
  FormActionsWrapper,
  ProductFormActions,
  VariantFormActions,
} from "./actions";

// Sidebar components
export { IdentifiersSidebar } from "./sidebars/identifiers-sidebar";
export { StatusSidebar } from "./sidebars/status-sidebar";
export { VariantsOverview } from "./sidebars/variants-overview";
