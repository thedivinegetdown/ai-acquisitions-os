import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getPermissionsForUser,
  getRoleFromUser,
  getValidatedSession,
  isSessionExpired,
  refreshCurrentSession,
  sendPasswordResetEmail,
  signInWithPassword,
  signOut as signOutWithSupabase,
  subscribeToSession,
} from "../services/auth";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applySession = useCallback((nextSession) => {
    setSession(nextSession);
    setUser(nextSession?.user || null);
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await refreshCurrentSession();

    if (result.error) {
      setError(result.error);
      applySession(null);
      return result;
    }

    applySession(result.session);
    setError(null);
    return result;
  }, [applySession]);

  useEffect(() => {
    let mounted = true;

    async function initializeSession() {
      setLoading(true);

      const result = await getValidatedSession();

      if (!mounted) return;

      if (result.error) {
        setError(result.error);
        applySession(null);
      } else {
        applySession(result.session);
        setError(null);
      }

      setLoading(false);
    }

    initializeSession();

    const unsubscribe = subscribeToSession(({ session: nextSession }) => {
      if (!mounted) return;

      if (nextSession && isSessionExpired(nextSession)) {
        refreshSession();
        return;
      }

      applySession(nextSession);
      setError(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applySession, refreshSession]);

  const signIn = useCallback(async ({ email, password }) => {
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError);
      applySession(null);
      setLoading(false);
      return { success: false, error: signInError };
    }

    applySession(data.session);
    setLoading(false);
    return { success: true, session: data.session, user: data.user };
  }, [applySession]);

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { error: signOutError } = await signOutWithSupabase();

    applySession(null);
    setLoading(false);

    if (signOutError) {
      setError(signOutError);
      return { success: false, error: signOutError };
    }

    return { success: true };
  }, [applySession]);

  const requestPasswordReset = useCallback(async (email) => {
    setError(null);

    const redirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/`;
    const { error: resetError } = await sendPasswordResetEmail(
      email,
      redirectTo
    );

    if (resetError) {
      setError(resetError);
      return { success: false, error: resetError };
    }

    return { success: true };
  }, []);

  const role = useMemo(() => getRoleFromUser(user), [user]);
  const permissions = useMemo(() => getPermissionsForUser(user), [user]);

  const value = useMemo(
    () => ({
      clearError: () => setError(null),
      error,
      isAuthenticated: Boolean(session?.access_token),
      loading,
      permissions,
      refreshSession,
      requestPasswordReset,
      role,
      session,
      signIn,
      signOut,
      user,
    }),
    [
      error,
      loading,
      permissions,
      refreshSession,
      requestPasswordReset,
      role,
      session,
      signIn,
      signOut,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
