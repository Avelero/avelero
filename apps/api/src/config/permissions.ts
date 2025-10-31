/**
 * Human-readable permission map keyed by brand role.
 *
 * The router layer uses these values to decide which actions a member can take
 * without scattering string comparisons throughout the codebase.
 */
export const PERMISSIONS = {
  owner: [
    "brand:create",
    "brand:read",
    "brand:update",
    "brand:delete",
    "member:invite",
    "member:remove",
    "member:change_role",
    "content:manage_all", // Can manage all content within the brand
  ],
  member: [
    "brand:read",
    "content:create_own", // Can create their own content
    "content:edit_own", // Can edit their own content
  ],
};

/**
 * Narrow type representing the available role keys.
 */
export type Role = keyof typeof PERMISSIONS;
/**
 * Union of permissions supported by the application.
 */
export type Permission = (typeof PERMISSIONS)[Role][number];

/**
 * Checks whether the supplied role grants the given permission.
 *
 * @param role - Role identifier, typically derived from `ROLES`.
 * @param permission - Permission string to validate.
 * @returns True when the role includes the requested permission.
 */
export const hasPermission = (role: Role, permission: Permission): boolean => {
  return PERMISSIONS[role]?.includes(permission);
};
