import { useCallback, useEffect, useMemo, useState } from "react";
import { getRecommendationBoundaryFingerprint } from "../services/decision-intelligence/decisionMemoryService";
import {
  appendOwnerDecision,
  appendRecommendationSnapshot,
  loadDecisionMemoryByDeal,
} from "../services/repositories/decisionMemoryRepository";

const EMPTY_HISTORY = Object.freeze({
  entries: [],
  counts: { snapshots: 0, decisions: 0, linkedOutcomes: 0 },
  limitation: "Later lifecycle records are chronologically linked references, not evidence of causation.",
});

export default function useDecisionMemory({ deal, readModel } = {}) {
  const [history, setHistory] = useState(EMPTY_HISTORY);
  const [loading, setLoading] = useState(Boolean(deal?.id));
  const [error, setError] = useState("");
  const boundaryFingerprint = getRecommendationBoundaryFingerprint(readModel);
  const dealId = deal?.id;

  const reload = useCallback(async () => {
    if (!dealId) {
      setHistory(EMPTY_HISTORY);
      return null;
    }
    const result = await loadDecisionMemoryByDeal(dealId);
    if (result.success) {
      setHistory(result.data || EMPTY_HISTORY);
      return result.data;
    }
    setError(result.error?.message || "Could not load Decision Memory.");
    return null;
  }, [dealId]);

  useEffect(() => {
    let active = true;
    async function synchronize() {
      if (!dealId) return;
      setLoading(true);
      setError("");
      const snapshotResult = await appendRecommendationSnapshot({ deal, readModel });
      const memoryResult = await loadDecisionMemoryByDeal(dealId);
      if (!active) return;
      if (memoryResult.success) setHistory(memoryResult.data || EMPTY_HISTORY);
      const failure = !snapshotResult.success ? snapshotResult : !memoryResult.success ? memoryResult : null;
      if (failure) setError(failure.error?.message || "Could not synchronize Decision Memory.");
      setLoading(false);
    }
    synchronize();
    return () => {
      active = false;
    };
  }, [boundaryFingerprint, deal, dealId, readModel]);

  const currentEntry = useMemo(() => [...history.entries].reverse().find(
    (entry) => entry.snapshot.canonical_input_fingerprint === boundaryFingerprint
  ) || null, [boundaryFingerprint, history.entries]);

  const recordDecision = useCallback(async (command) => {
    if (!currentEntry?.snapshot) {
      return { success: false, error: { message: "The current recommendation has not been memorized." } };
    }
    const result = await appendOwnerDecision({ ...command, snapshot: currentEntry.snapshot });
    if (!result.success) {
      setError(result.error?.message || "Could not record the owner decision.");
      return result;
    }
    setError("");
    await reload();
    return result;
  }, [currentEntry, reload]);

  return {
    currentEntry,
    error,
    history,
    loading,
    recordDecision,
    reload,
  };
}
