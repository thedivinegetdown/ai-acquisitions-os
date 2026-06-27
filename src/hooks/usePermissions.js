import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "../services/auth";
import { useAuth } from "./useAuth";

export function usePermissions() {
  const { permissions, role, user } = useAuth();

  return {
    can: (permissionKey) => hasPermission(role, permissionKey),
    hasAll: (permissionKeys) => hasAllPermissions(role, permissionKeys),
    hasAny: (permissionKeys) => hasAnyPermission(role, permissionKeys),
    permissions,
    role,
    user,
  };
}
