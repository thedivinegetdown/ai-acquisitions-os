import AuthScreen from "./AuthScreen";
import LazyPanelFallback from "./LazyPanelFallback";
import { buildAuthGuardState } from "../services/auth";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const { loading, session } = useAuth();
  const guard = buildAuthGuardState({ loading, session });

  if (guard.loading) {
    return <LazyPanelFallback label="Loading session..." />;
  }

  if (!guard.allowed) {
    return <AuthScreen />;
  }

  return children;
}
