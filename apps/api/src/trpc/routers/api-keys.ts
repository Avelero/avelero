import { createTRPCRouter, protectedProcedure } from "../init.js";

export const apiKeysRouter = createTRPCRouter({
  // Placeholder endpoints for future API key management
  list: protectedProcedure.query(async () => {
    return { data: [] } as const;
  }),
});


