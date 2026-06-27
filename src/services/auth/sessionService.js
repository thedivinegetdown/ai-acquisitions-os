import {
  getSession,
  getUser,
  onAuthStateChange,
  refreshSession,
} from "./authService";

const SESSION_EXPIRY_BUFFER_SECONDS = 60;

export function getSessionExpiresAt(session) {
  return session?.expires_at ? session.expires_at * 1000 : null;
}

export function isSessionExpired(session, now = Date.now()) {
  const expiresAt = getSessionExpiresAt(session);

  if (!expiresAt) return true;

  return expiresAt - now <= SESSION_EXPIRY_BUFFER_SECONDS * 1000;
}

export async function getCurrentSession() {
  const { data, error } = await getSession();

  if (error) {
    return { session: null, user: null, error };
  }

  return {
    session: data.session,
    user: data.session?.user || null,
    error: null,
  };
}

export async function getValidatedSession() {
  const current = await getCurrentSession();

  if (current.error || !current.session) {
    return current;
  }

  if (!isSessionExpired(current.session)) {
    return current;
  }

  const refreshed = await refreshCurrentSession();

  if (refreshed.session) {
    return refreshed;
  }

  return current;
}

export async function getValidatedUser() {
  const { data, error } = await getUser();

  return {
    user: data?.user || null,
    error,
  };
}

export async function refreshCurrentSession() {
  const { data, error } = await refreshSession();

  return {
    session: data?.session || null,
    user: data?.session?.user || null,
    error,
  };
}

export function subscribeToSession(callback) {
  return onAuthStateChange((event, session) => {
    callback({
      event,
      session,
      user: session?.user || null,
    });
  });
}
