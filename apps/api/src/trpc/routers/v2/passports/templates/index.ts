/**
 * Passport templates router scaffold.
 *
 * Targets:
 * - passports.templates.list
 * - passports.templates.get
 * - passports.templates.create
 * - passports.templates.update (supports optional modules payload)
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../../../init.js";

const templateListProcedure = protectedProcedure.query(async () => {
  throw new Error("passports.templates.list is not implemented yet");
});

const templateGetProcedure = protectedProcedure.query(async () => {
  throw new Error("passports.templates.get is not implemented yet");
});

const templateMutationProcedure = brandRequiredProcedure.mutation(async () => {
  throw new Error("passport template mutation is not implemented yet");
});

export const passportTemplatesRouter = createTRPCRouter({
  list: templateListProcedure,
  get: templateGetProcedure,
  create: templateMutationProcedure,
  update: templateMutationProcedure,
});

export type PassportTemplatesRouter = typeof passportTemplatesRouter;
