/**
 * Brand domain router.
 *
 * Bundles brand lifecycle management, member management, invite management,
 * theme configuration, and saved collections under the `brand.*` namespace.
 *
 * Phase 4 changes:
 * - Renamed from `workflow.*` to `brand.*`
 * - Removed `list`, `create`, `setActive` (moved to user.brands.*)
 * - Added `collections` sub-router for saved product filters
 */
import { createTRPCRouter } from "../../init.js";
import {
  brandCheckSlugProcedure,
  brandDeleteProcedure,
  brandUpdateProcedure,
} from "./base.js";
import { brandCollectionsRouter } from "./collections.js";
import { brandInvitesRouter } from "./invites.js";
import { brandMembersRouter } from "./members.js";
import { themePreviewRouter } from "./theme-preview.js";
import { brandThemeRouter } from "./theme.js";

export const brandRouter = createTRPCRouter({
  // Brand lifecycle (update/delete only - list/create/setActive moved to user.brands)
  update: brandUpdateProcedure,
  delete: brandDeleteProcedure,
  checkSlug: brandCheckSlugProcedure,
  // Nested routers for brand-scoped resources
  members: brandMembersRouter,
  invites: brandInvitesRouter,
  theme: brandThemeRouter,
  themePreview: themePreviewRouter,
  collections: brandCollectionsRouter,
});

type BrandRouter = typeof brandRouter;
