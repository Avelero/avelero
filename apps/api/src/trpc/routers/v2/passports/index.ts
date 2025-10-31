/**
 * Passports domain router scaffold.
 *
 * Covers passport CRUD, analytics helpers, and nested template management
 * (`passports.templates.*`).
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../../init.js";
import { passportTemplatesRouter } from "./templates/index.js";

const listProcedure = protectedProcedure.query(async () => {
  throw new Error("passports.list is not implemented yet");
});

const getProcedure = protectedProcedure.query(async () => {
  throw new Error("passports.get is not implemented yet");
});

const mutationProcedure = brandRequiredProcedure.mutation(async () => {
  throw new Error("passport mutation is not implemented yet");
});

export const passportsRouter = createTRPCRouter({
  list: listProcedure,
  get: getProcedure,
  create: mutationProcedure,
  update: mutationProcedure,
  delete: mutationProcedure,
  templates: passportTemplatesRouter,
});

export type PassportsRouter = typeof passportsRouter;
