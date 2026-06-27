import {
  getPermissionsForRole,
  PERMISSIONS,
  TEAM_ROLES,
} from "../team/permissionService";

export const AUTH_ROLES = [...TEAM_ROLES];
export const DEFAULT_AUTH_ROLE = "Viewer";

export function normalizeRole(role, fallback = DEFAULT_AUTH_ROLE) {
  return AUTH_ROLES.includes(role) ? role : fallback;
}

export function getRoleFromUser(user, fallback = DEFAULT_AUTH_ROLE) {
  const role =
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    user?.role ||
    fallback;

  return normalizeRole(role, fallback);
}

export function getPermissionKeys() {
  return PERMISSIONS.map((permission) => permission.key);
}

export function getPermissionsForUser(user) {
  return getPermissionsForRole(getRoleFromUser(user));
}

export function hasPermission(userOrRole, permissionKey) {
  const role =
    typeof userOrRole === "string"
      ? normalizeRole(userOrRole)
      : getRoleFromUser(userOrRole);
  const permissions = getPermissionsForRole(role);

  return Boolean(permissions[permissionKey]);
}

export function hasAnyPermission(userOrRole, permissionKeys = []) {
  return permissionKeys.some((permissionKey) =>
    hasPermission(userOrRole, permissionKey)
  );
}

export function hasAllPermissions(userOrRole, permissionKeys = []) {
  return permissionKeys.every((permissionKey) =>
    hasPermission(userOrRole, permissionKey)
  );
}

export function canAccessRole(userOrRole, allowedRoles = []) {
  const role =
    typeof userOrRole === "string"
      ? normalizeRole(userOrRole)
      : getRoleFromUser(userOrRole);

  return allowedRoles.includes(role);
}
