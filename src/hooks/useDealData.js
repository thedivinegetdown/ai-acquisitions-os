import { useCallback, useEffect, useState } from "react";
import { listDeals } from "../services/repositories";

export const useDealData = () => {
  const [deals, setDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDeals = useCallback(async () => {
    setLoading(true);

    const result = await listDeals();

    if (!result.success) {
      console.error("Failed to load deals:", result.error);
      setError(result.error?.message || "Could not load deals.");
      setDeals([]);
      setFilteredDeals([]);
    } else {
      const rows = result.data || [];
      setError("");
      setDeals(rows);
      setFilteredDeals(rows);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  return {
    deals,
    setDeals,
    filteredDeals,
    setFilteredDeals,
    loading,
    error,
    loadDeals,
  };
};
