import { useCallback, useEffect, useRef, useState } from "react";

// New hook reason: Today, Pipeline, and Inbox need one bounded communication
// summary source; existing timeline hooks load one thread and cannot share this state.
export function useConversationData({
  dealLoadError = null,
  deals = [],
  enabled = false,
  organizationId = "",
  tenantId = "",
} = {}) {
  const [readModel, setReadModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const modelRef = useRef(null);
  const requestRef = useRef(0);

  const executeLoad = useCallback(
    async ({ force = false } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      const hasCurrentModel = Boolean(modelRef.current);

      if (hasCurrentModel) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const { loadInboxReadModel } = await import(
          "../services/conversations/inboxService"
        );
        const result = await loadInboxReadModel({
          deals,
          errors: [dealLoadError].filter(Boolean),
          force,
          organizationId,
          tenantId,
        });

        if (requestRef.current !== requestId) return result;

        if (!result.success) {
          setError("Inbox conversations could not be loaded.");
          return result;
        }

        modelRef.current = result.data;
        setReadModel(result.data);
        return result;
      } catch {
        if (requestRef.current === requestId) {
          setError("Inbox conversations could not be loaded.");
        }
        return {
          success: false,
          error: { message: "Inbox conversations could not be loaded." },
        };
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [dealLoadError, deals, organizationId, tenantId]
  );

  useEffect(() => {
    if (!enabled) return undefined;

    executeLoad().catch(() => {});
    return () => {
      requestRef.current += 1;
    };
  }, [enabled, executeLoad]);

  const refresh = useCallback(async () => {
    const result = await executeLoad({ force: true });
    if (!result.success) {
      throw new Error("Inbox conversations could not be refreshed.");
    }
    return result;
  }, [executeLoad]);

  return {
    conversations: readModel?.items || [],
    error,
    loading,
    readModel,
    refresh,
    refreshing,
  };
}
