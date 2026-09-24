import { useCallback, useEffect, useState } from "react";
import { listSellerTasks, listSequenceSteps } from "../services/repositories";

async function fetchDailyCommitments() {
  const [taskResult, sequenceResult] = await Promise.all([
    listSellerTasks(),
    listSequenceSteps(),
  ]);

  return {
    sellerTasks: taskResult.success ? taskResult.data || [] : [],
    sequenceSteps: sequenceResult.success ? sequenceResult.data || [] : [],
    errors: [taskResult, sequenceResult]
      .filter((result) => !result.success)
      .map((result) => result.error?.message || "Could not load a commitment source."),
  };
}

export function useDailyCommitmentData({ enabled = true } = {}) {
  const [sellerTasks, setSellerTasks] = useState([]);
  const [sequenceSteps, setSequenceSteps] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [errors, setErrors] = useState([]);

  const loadCommitments = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const result = await fetchDailyCommitments();
    setSellerTasks(result.sellerTasks);
    setSequenceSteps(result.sequenceSteps);
    setErrors(result.errors);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    async function loadInitialCommitments() {
      await Promise.resolve();
      if (!cancelled) setLoading(true);
      const result = await fetchDailyCommitments();
      if (cancelled) return;
      setSellerTasks(result.sellerTasks);
      setSequenceSteps(result.sequenceSteps);
      setErrors(result.errors);
      setLoading(false);
    }

    loadInitialCommitments();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { sellerTasks, sequenceSteps, loading, errors, loadCommitments };
}
