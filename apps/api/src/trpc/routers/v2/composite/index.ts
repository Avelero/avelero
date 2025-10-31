/**
 * Composite endpoints router scaffold.
 *
 * Targets:
 * - composite.workflowInit
 * - composite.dashboard
 * - composite.membersWithInvites
 * - composite.passportFormReferences
 */
import {
  brandRequiredProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../../../init.js";

const brandAwareQuery = brandRequiredProcedure.query(async () => {
  throw new Error("composite query not implemented yet");
});

const sharedQuery = protectedProcedure.query(async () => {
  throw new Error("composite query not implemented yet");
});

export const compositeRouter = createTRPCRouter({
  workflowInit: sharedQuery,
  dashboard: brandAwareQuery,
  membersWithInvites: brandAwareQuery,
  passportFormReferences: brandAwareQuery,
});

export type CompositeRouter = typeof compositeRouter;
