// apps/api/src/config/permissions.ts

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

export type Role = keyof typeof PERMISSIONS;
export type Permission = (typeof PERMISSIONS)[Role][number];

// Helper function to check if a role has a specific permission
export const hasPermission = (role: Role, permission: Permission): boolean => {
  return PERMISSIONS[role]?.includes(permission);
};
