import { useCallback, useEffect, useState } from "react";
import { buildOwnerOperatingReport } from "../services/reporting";
import { loadOwnerOperatingReportSources } from "../services/repositories";

export function useOwnerOperatingReport({ enabled = true } = {}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const evaluatedAt = new Date().toISOString();
    const result = await loadOwnerOperatingReportSources();
    if (!result.success) {
      setReport(null);
      setError(result.error?.message || "Could not load the owner operating report.");
    } else {
      const data = result.data;
      setReport(
        buildOwnerOperatingReport({
          organizationId: data.organizationId,
          evaluatedAt,
          sources: data.sources,
          sourceErrors: data.sourceErrors,
        })
      );
      setError("");
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    async function load() {
      const evaluatedAt = new Date().toISOString();
      const result = await loadOwnerOperatingReportSources();
      if (cancelled) return;
      if (!result.success) {
        setReport(null);
        setError(result.error?.message || "Could not load the owner operating report.");
      } else {
        const data = result.data;
        setReport(
          buildOwnerOperatingReport({
            organizationId: data.organizationId,
            evaluatedAt,
            sources: data.sources,
            sourceErrors: data.sourceErrors,
          })
        );
        setError("");
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { error, loading, refresh: loadReport, report };
}
