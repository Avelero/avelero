import { createTRPCRouter, protectedProcedure } from "../init.js";

// Minimal placeholder: this project doesn't implement OAuth app registry yet.
export const oauthApplicationsRouter = createTRPCRouter({
  list: protectedProcedure.query(async () => ({ data: [] as const })),
});


