import { useCallback, useEffect, useMemo, useState } from "react";
import { getWorkspaceById, getWorkspaceByRoute, normalizeWorkspaceRoute } from "./workspaces";

function readLocationPath() {
  if (typeof window === "undefined") return "/today";
  return normalizeWorkspaceRoute(window.location.pathname);
}

export function useWorkspaceRouter() {
  const [currentPath, setCurrentPath] = useState(readLocationPath);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(readLocationPath());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const currentWorkspace = useMemo(() => getWorkspaceByRoute(currentPath), [currentPath]);

  const navigateToWorkspace = useCallback((workspaceId) => {
    const workspace = getWorkspaceById(workspaceId);
    if (!workspace || typeof window === "undefined") return;

    const nextPath = workspace.route;
    if (normalizeWorkspaceRoute(window.location.pathname) !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setCurrentPath(nextPath);
  }, []);

  return {
    currentPath,
    currentWorkspace,
    currentWorkspaceId: currentWorkspace?.id || "unknown",
    isUnknownRoute: !currentWorkspace,
    navigateToWorkspace,
  };
}
