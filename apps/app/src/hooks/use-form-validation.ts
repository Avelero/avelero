/**
 * Generic form validation utilities.
 *
 * Provides type-safe validation functions that can be used with any form.
 * Validation rules are defined as functions that return error messages.
 */

import { isValidEmail, isValidUrl, validatePhone } from "@/utils/validation";

export type ValidationRule<TValue> = (value: TValue) => string | undefined;

export type ValidationSchema<TFormData> = {
  [K in keyof TFormData]?:
    | ValidationRule<TFormData[K]>
    | ValidationRule<TFormData[K]>[];
};

export type ValidationErrors<TFormData> = {
  [K in keyof TFormData]?: string;
};

/**
 * Validates form data against a validation schema.
 *
 * @template TFormData - The shape of your form data
 * @param data - Form data to validate
 * @param schema - Validation schema with rules for each field
 * @returns Object with validation errors (empty if valid)
 *
 * @example
 * ```tsx
 * const schema: ValidationSchema<{ name: string; email: string }> = {
 *   name: (value) => !value ? "Name is required" : undefined,
 *   email: [
 *     (value) => !value ? "Email is required" : undefined,
 *     (value) => !value.includes("@") ? "Invalid email" : undefined,
 *   ],
 * };
 *
 * const errors = validateForm({ name: "", email: "test" }, schema);
 * // { name: "Name is required", email: "Invalid email" }
 * ```
 */
export function validateForm<TFormData extends Record<string, any>>(
  data: TFormData,
  schema: ValidationSchema<TFormData>,
): ValidationErrors<TFormData> {
  const errors: ValidationErrors<TFormData> = {};

  for (const field in schema) {
    const rule = schema[field];
    if (!rule) continue;

    const value = data[field];
    const rules = Array.isArray(rule) ? rule : [rule];

    for (const validationRule of rules) {
      const error = validationRule(value);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }

  return errors;
}

/**
 * Checks if form is valid (no errors).
 */
export function isFormValid<TFormData>(
  errors: ValidationErrors<TFormData>,
): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * Gets the first invalid field name for focusing.
 *
 * @param errors - Validation errors object
 * @param fieldOrder - Optional priority order for fields (first field in order takes precedence)
 * @returns First invalid field name, or null if form is valid
 */
export function getFirstInvalidField<TFormData>(
  errors: ValidationErrors<TFormData>,
  fieldOrder?: Array<keyof TFormData>,
): keyof TFormData | null {
  if (fieldOrder) {
    for (const field of fieldOrder) {
      if (errors[field]) {
        return field;
      }
    }
  }

  // If no order specified, return first error
  const firstError = Object.keys(errors)[0] as keyof TFormData | undefined;
  return firstError ?? null;
}

/**
 * Reusable validation helpers
 */
export const rules = {
  required:
    (message = "This field is required"): ValidationRule<any> =>
    (value) => {
      if (value === null || value === undefined) {
        return message;
      }
      const stringValue =
        typeof value === "string" ? value : String(value ?? "").trim();
      return stringValue ? undefined : message;
    },

  maxLength:
    (
      max: number,
      message = `Maximum ${max} characters`,
    ): ValidationRule<string> =>
    (value) => {
      if (!value) {
        return undefined;
      }
      return value.length > max ? message : undefined;
    },

  maxArrayLength:
    (max: number, message = `Maximum ${max} items`): ValidationRule<any[]> =>
    (value) => {
      if (!Array.isArray(value)) {
        return undefined;
      }
      return value.length > max ? message : undefined;
    },

  positiveNumeric:
    (
      message = "Value must be a valid positive number",
    ): ValidationRule<string> =>
    (value) => {
      if (!value?.trim()) {
        return undefined;
      }
      const normalized = value.replaceAll(",", ".").trim();
      const numericValue = Number.parseFloat(normalized);
      if (Number.isNaN(numericValue) || numericValue < 0) {
        return message;
      }
      return undefined;
    },

  ean:
    (message = "EAN must be 8, 13, or 14 digits"): ValidationRule<string> =>
    (value) => {
      if (!value?.trim()) {
        return undefined;
      }
      const trimmed = value.trim();
      const eanRegex = /^\d{8}$|^\d{13}$|^\d{14}$/;
      return eanRegex.test(trimmed) ? undefined : message;
    },

  email:
    (message = "Please enter a valid email address"): ValidationRule<string> =>
    (value) => {
      if (!value?.trim()) {
        return undefined;
      }
      return isValidEmail(value) ? undefined : message;
    },

  url:
    (message = "Please enter a valid URL"): ValidationRule<string> =>
    (value) => {
      if (!value?.trim()) {
        return undefined;
      }
      return isValidUrl(value) ? undefined : message;
    },

  phone:
    (message = "Please enter a valid phone number"): ValidationRule<string> =>
    (value) => {
      if (!value?.trim()) {
        return undefined;
      }
      const result = validatePhone(value);
      return result.isValid ? undefined : result.error ?? message;
    },

  uniqueCaseInsensitive:
    (
      existingValues: string[],
      message = "This value already exists",
    ): ValidationRule<string> =>
    (value) => {
      if (!value?.trim()) {
        return undefined;
      }
      const normalized = value.trim().toLowerCase();
      const exists = existingValues.some(
        (existing) => existing.trim().toLowerCase() === normalized,
      );
      return exists ? message : undefined;
    },
};
