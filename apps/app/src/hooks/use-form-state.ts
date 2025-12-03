import * as React from "react";

/**
 * Generic form state management hook using useReducer.
 *
 * Provides a single source of truth for form fields and validation state.
 * Can be used with any form by providing initial state and field definitions.
 *
 * @template TState - The shape of your form state
 * @param initialState - Initial form state
 * @returns Form state and update functions
 *
 * @example
 * ```tsx
 * const { state, setField, setFields, resetForm } = useFormState({
 *   name: "",
 *   email: "",
 *   age: 0,
 * });
 *
 * // Update single field
 * setField("name", "John");
 *
 * // Update multiple fields
 * setFields({ name: "John", email: "john@example.com" });
 * ```
 */
export function useFormState<TState extends Record<string, any>>(
  initialState: TState,
) {
  type FieldName = keyof TState;
  type FieldValue<T extends FieldName> = TState[T];

  type FormAction<T extends FieldName> =
    | { type: "SET_FIELD"; field: T; value: FieldValue<T> }
    | { type: "SET_FIELDS"; fields: Partial<TState> }
    | { type: "RESET_FORM" };

  function formReducer(state: TState, action: FormAction<FieldName>): TState {
    switch (action.type) {
      case "SET_FIELD":
        return { ...state, [action.field]: action.value };
      case "SET_FIELDS":
        return { ...state, ...action.fields };
      case "RESET_FORM":
        return { ...initialState };
      default:
        return state;
    }
  }

  const [state, dispatch] = React.useReducer(formReducer, initialState);

  // Create typed setter for a single field
  const setField = React.useCallback(
    <T extends FieldName>(field: T, value: FieldValue<T>) => {
      dispatch({ type: "SET_FIELD", field, value });
    },
    [],
  );

  // Update field using callback (helpful for arrays/objects)
  const updateField = React.useCallback(
    <T extends FieldName>(
      field: T,
      updater: (prev: FieldValue<T>) => FieldValue<T>,
    ) => {
      dispatch({ type: "SET_FIELD", field, value: updater(state[field]) });
    },
    [state],
  );

  // Create setter for multiple fields at once
  const setFields = React.useCallback((fields: Partial<TState>) => {
    dispatch({ type: "SET_FIELDS", fields });
  }, []);

  // Reset form to initial state
  const resetForm = React.useCallback(() => {
    dispatch({ type: "RESET_FORM" });
  }, []);

  return {
    state,
    setField,
    updateField,
    setFields,
    resetForm,
  };
}
