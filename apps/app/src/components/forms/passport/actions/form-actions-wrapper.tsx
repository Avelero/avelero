"use client";

/**
 * FormActionsWrapper
 *
 * Conditionally renders the correct action buttons based on form type.
 * Uses context to determine if we're on a product or variant form.
 */

import { ProductFormActions } from "@/components/forms/passport/actions/product-actions";
import { VariantFormActions } from "@/components/forms/passport/actions/variant-actions";
import { usePassportFormContext } from "@/contexts/passport-form-context";

export function FormActionsWrapper() {
    const { formType, variantUpid } = usePassportFormContext();

    if (formType === "variant") {
        // Determine if create mode based on variantUpid
        const mode = variantUpid === "new" ? "create" : "edit";
        return <VariantFormActions mode={mode} />;
    }

    return <ProductFormActions />;
}
