/**
 * Passport Forms
 *
 * Consolidated exports for all passport form components including:
 * - Product forms (create/edit)
 * - Variant forms
 * - Scaffolds, sidebars, skeletons, and actions
 */

// Main form components
export { CreateProductForm, EditProductForm } from "./product-form";
export { VariantForm, EditVariantForm, CreateVariantForm } from "./variant-form";

// Action components
export { FormActionsWrapper } from "./actions/form-actions-wrapper";
export { ProductFormActions } from "./actions/product-actions";
export { VariantFormActions } from "./actions/variant-actions";

// Scaffold components
export { ProductFormScaffold } from "./scaffolds/product-scaffold";
export { VariantFormScaffold } from "./scaffolds/variant-scaffold";

// Sidebar components
export { IdentifiersSidebar } from "./sidebars/identifiers-sidebar";
export { StatusSidebar } from "./sidebars/status-sidebar";
export { VariantsOverview } from "./sidebars/variants-overview";

// Skeleton components
export { ProductFormSkeleton } from "./skeletons/product-skeleton";
export { VariantFormSkeleton } from "./skeletons/variant-skeleton";
