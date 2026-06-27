import { useAuth } from "./useAuth";

export function useSession() {
  const { loading, refreshSession, session, user } = useAuth();

  return {
    loading,
    refreshSession,
    session,
    user,
  };
}
