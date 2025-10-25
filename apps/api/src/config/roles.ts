/**
 * Defines the available user roles in the application.
 * This object serves as a centralized source of truth for role names,
 * preventing the use of magic strings throughout the codebase.
 */
export const ROLES = {
  OWNER: "owner",
  MEMBER: "member",
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
