import { useEffect, useMemo, useState } from "react";
import { createServiceError } from "../../../utils/errors";
import {
  buildCommunicationTimeline,
  loadCommunicationHistory,
} from "../services";

export function useConversationTimeline({
  phone,
  deal = null,
  refreshKey = 0,
  localEvents = [],
} = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTimeline() {
      setLoading(true);
      setError("");

      const result = await loadCommunicationHistory({
        phone,
        deal,
      });

      if (!isMounted) return;

      if (!result.success) {
        setMessages([]);
        setError(result.error?.message || "Could not load communications.");
        setLoading(false);
        return;
      }

      setMessages(result.data.messages || []);
      setLoading(false);
    }

    loadTimeline().catch((loadError) => {
      if (!isMounted) return;
      const serviceError = createServiceError(loadError, "Could not load communications.");
      setMessages([]);
      setError(serviceError.message);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [phone, deal?.id, deal?.phone, refreshKey]);

  const timeline = useMemo(
    () =>
      buildCommunicationTimeline({
        messages,
        notes: localEvents.filter((event) => event.channel === "note"),
        systemEvents: localEvents.filter((event) => event.channel !== "note"),
        deal,
      }),
    [messages, localEvents, deal]
  );

  return {
    timeline,
    messages,
    loading,
    error,
  };
}
