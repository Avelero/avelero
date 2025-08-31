import { createTRPCRouter } from "../init.js";
import { brandRouter } from "./brand.js";
import { userRouter } from "./user.js";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export const appRouter = createTRPCRouter({
  brand: brandRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;


