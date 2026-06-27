import { getValidatedSession, isSessionExpired } from "./sessionService";

export function isAuthenticated(session) {
  return Boolean(session?.access_token && !isSessionExpired(session));
}

export function getUnauthorizedReason(session) {
  if (!session) return "missing_session";
  if (!session.access_token) return "missing_access_token";
  if (isSessionExpired(session)) return "expired_session";

  return null;
}

export async function requireAuthenticatedSession() {
  const { session, user, error } = await getValidatedSession();
  const unauthorizedReason = getUnauthorizedReason(session);

  return {
    allowed: !error && !unauthorizedReason,
    error,
    session,
    unauthorizedReason,
    user,
  };
}

export function buildAuthGuardState({ session, loading }) {
  if (loading) {
    return {
      allowed: false,
      loading: true,
      unauthorizedReason: null,
    };
  }

  const unauthorizedReason = getUnauthorizedReason(session);

  return {
    allowed: !unauthorizedReason,
    loading: false,
    unauthorizedReason,
  };
}
