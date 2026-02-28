/**
 * Defines the available user roles in the application.
 * This object serves as a centralized source of truth for role names,
 * preventing the use of magic strings throughout the codebase.
 */
export const ROLES = {
  OWNER: "owner",
  MEMBER: "member",
  AVELERO: "avelero",
} as const;

/**
 * Type definition for the available user roles.
 * Derived from the `ROLES` object to ensure type safety and consistency.
 */
export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Type guard to validate if a value is a valid Role at runtime.
 * Use this instead of type assertions to ensure type safety.
 */
export function isRole(value: unknown): value is Role {
  if (typeof value !== "string") return false;
  return Object.values(ROLES).includes(value as Role);
}

/**
 * Owner-equivalent roles with full brand administration permissions.
 */
export const OWNER_EQUIVALENT_ROLES = [
  ROLES.OWNER,
  ROLES.AVELERO,
] as const;

/**
 * Type guard for owner-equivalent roles.
 */
export function isOwnerEquivalentRole(value: unknown): value is Role {
  if (typeof value !== "string") return false;
  return OWNER_EQUIVALENT_ROLES.includes(
    value as (typeof OWNER_EQUIVALENT_ROLES)[number],
  );
}
