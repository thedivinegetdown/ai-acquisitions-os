import { safeTrim } from "../../utils/text";

export const DEFAULT_USER_ID = "local-user";
export const DEFAULT_USER_ROLE = "Owner";

export function buildDefaultUser() {
  return {
    id: DEFAULT_USER_ID,
    name: "Local User",
    email: "",
    role: DEFAULT_USER_ROLE,
  };
}

export function normalizeUser(user = {}) {
  const fallback = buildDefaultUser();

  return {
    id: safeTrim(user.id) || fallback.id,
    name: safeTrim(user.name || user.fullName) || fallback.name,
    email: safeTrim(user.email),
    role: safeTrim(user.role) || fallback.role,
  };
}

export function getCurrentRole(context = {}) {
  return context.currentRole || context.user?.role || DEFAULT_USER_ROLE;
}
