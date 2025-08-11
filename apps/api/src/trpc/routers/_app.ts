import { createTRPCRouter } from "../init.js";
import { apiKeysRouter } from "./api-keys.js";
import { oauthApplicationsRouter } from "./oauth-applications.js";
import { brandRouter } from "./brand.js";
import { userRouter } from "./user.js";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export const appRouter = createTRPCRouter({
  apiKeys: apiKeysRouter,
  oauthApplications: oauthApplicationsRouter,
  brand: brandRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;


