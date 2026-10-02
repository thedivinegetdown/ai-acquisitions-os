import { useCallback, useEffect, useState } from "react";
import {
  listSellerTasks,
  listSequenceSteps,
  loadOrganizationSettings,
} from "../services/repositories";

async function fetchDailyCommitments() {
  const [taskResult, sequenceResult, settingsResult] = await Promise.all([
    listSellerTasks(),
    listSequenceSteps(),
    loadOrganizationSettings(),
  ]);

  return {
    businessTimeZone: settingsResult.success ? settingsResult.data?.default_timezone || "" : "",
    sellerTasks: taskResult.success ? taskResult.data || [] : [],
    sequenceSteps: sequenceResult.success ? sequenceResult.data || [] : [],
    errors: [taskResult, sequenceResult, settingsResult]
      .filter((result) => !result.success)
      .map((result) => result.error?.message || "Could not load a commitment source."),
  };
}

export function useDailyCommitmentData({ enabled = true } = {}) {
  const [businessTimeZone, setBusinessTimeZone] = useState("");
  const [sellerTasks, setSellerTasks] = useState([]);
  const [sequenceSteps, setSequenceSteps] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [errors, setErrors] = useState([]);

  const loadCommitments = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const result = await fetchDailyCommitments();
    setBusinessTimeZone(result.businessTimeZone);
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
      setBusinessTimeZone(result.businessTimeZone);
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

  return { businessTimeZone, sellerTasks, sequenceSteps, loading, errors, loadCommitments };
}
