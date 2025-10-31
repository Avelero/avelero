/**
 * Brand router aggregator.
 *
 * Composes all brand-related sub-routers into a single cohesive API surface.
 * Split for improved maintainability and separation of concerns.
 */
import { createTRPCRouter } from "../../init.js";
import { brandCrudRouter } from "./crud.js";
import { brandInvitesRouter } from "./invites.js";
import { brandLifecycleRouter } from "./lifecycle.js";
import { brandMembersRouter } from "./members.js";

/**
 * Main brand router exposing all brand operations.
 */
export const brandRouter = createTRPCRouter({
  // CRUD operations
  list: brandCrudRouter.list,
  create: brandCrudRouter.create,
  update: brandCrudRouter.update,
  delete: brandCrudRouter.delete,
  setActive: brandCrudRouter.setActive,

  // Lifecycle operations
  canLeave: brandLifecycleRouter.canLeave,
  leave: brandLifecycleRouter.leave,

  // Invite management
  sendInvite: brandInvitesRouter.send,
  revokeInvite: brandInvitesRouter.revoke,
  listInvites: brandInvitesRouter.list,
  myInvites: brandInvitesRouter.myInvites,
  acceptInvite: brandInvitesRouter.accept,
  rejectInvite: brandInvitesRouter.reject,

  // Member management
  members: brandMembersRouter.list,
  updateMember: brandMembersRouter.update,
  deleteMember: brandMembersRouter.delete,
});
