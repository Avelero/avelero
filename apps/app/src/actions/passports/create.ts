"use server";

// TODO: Implement create passport action
// This is a placeholder server action. It will be wired to TRPC or a server route later.
// Keep the signature stable so calling code does not churn.

export type CreatePassportInput = {
  // TODO: define input schema
  // For now we accept any to avoid blocking scaffolding.
  // Replace with a zod schema and proper type once implemented.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

/**
 * Create a passport resource from the provided input.
 *
 * @param input - The payload used to create the passport (schema not yet enforced)
 * @returns An object with `ok` indicating success, `id` containing the created resource identifier (currently a temporary placeholder), and `input` echoing the provided payload
 */
export async function createPassportAction(input: CreatePassportInput) {
  // TODO: call backend and return created resource
  // Temporary no-op to unblock UI wiring
  return { ok: true, id: "TEMP_UPID", input } as const;
}


