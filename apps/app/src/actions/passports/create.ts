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

export async function createPassportAction(input: CreatePassportInput) {
  // TODO: call backend and return created resource
  // Temporary no-op to unblock UI wiring
  return { ok: true, id: "TEMP_UPID", input } as const;
}



