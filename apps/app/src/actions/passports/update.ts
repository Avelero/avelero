"use server";

// TODO: Implement update passport action

export type UpdatePassportInput = {
  upid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any; // Replace with proper schema later
};

export async function updatePassportAction(input: UpdatePassportInput) {
  // TODO: call backend and return updated resource
  return { ok: true, id: input.upid, input } as const;
}



