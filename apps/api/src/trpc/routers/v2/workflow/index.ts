/**
 * Workflow domain router scaffold.
 *
 * Bundles brand lifecycle, member management, and invite management under
 * the new `workflow.*` namespace.
 */
import { createTRPCRouter } from "../../../init.js";
import {
  workflowListProcedure,
  workflowCreateProcedure,
  workflowDeleteProcedure,
} from "./base.js";
import { workflowMembersRouter } from "./members.js";
import { workflowInvitesRouter } from "./invites.js";

export const workflowRouter = createTRPCRouter({
  list: workflowListProcedure,
  create: workflowCreateProcedure,
  delete: workflowDeleteProcedure,
  // Expose fully nested routers for scoped resources.
  members: workflowMembersRouter,
  invites: workflowInvitesRouter,
});

export type WorkflowRouter = typeof workflowRouter;
