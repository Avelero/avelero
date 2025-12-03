/**
 * Workflow domain router scaffold.
 *
 * Bundles brand lifecycle, member management, and invite management under
 * the new `workflow.*` namespace.
 */
import { createTRPCRouter } from "../../init.js";
import {
  workflowCreateProcedure,
  workflowDeleteProcedure,
  workflowGetThemeProcedure,
  workflowListProcedure,
  workflowSetActiveProcedure,
  workflowUpdateProcedure,
} from "./base.js";
import { workflowInvitesRouter } from "./invites.js";
import { workflowMembersRouter } from "./members.js";
import { workflowThemeRouter } from "./theme.js";

export const workflowRouter = createTRPCRouter({
  list: workflowListProcedure,
  create: workflowCreateProcedure,
  update: workflowUpdateProcedure,
  setActive: workflowSetActiveProcedure,
  delete: workflowDeleteProcedure,
  getTheme: workflowGetThemeProcedure, // Kept for backwards compatibility
  // Expose fully nested routers for scoped resources.
  members: workflowMembersRouter,
  invites: workflowInvitesRouter,
  theme: workflowThemeRouter,
});

export type WorkflowRouter = typeof workflowRouter;
