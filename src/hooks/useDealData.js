import { useCallback, useEffect, useState } from "react";
import { listDeals } from "../services/repositories";

export const useDealData = () => {
  const [deals, setDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDeals = useCallback(async () => {
    setLoading(true);

    const result = await listDeals();

    if (!result.success) {
      console.error("Failed to load deals:", result.error);
      setDeals([]);
      setFilteredDeals([]);
    } else {
      const rows = result.data || [];
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
    loadDeals,
  };
};
