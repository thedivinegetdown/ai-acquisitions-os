import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const useDealData = () => {
  const [deals, setDeals] = useState([]);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDeals = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("property_address", { ascending: true });

    if (error) {
      console.error("Failed to load deals:", error);
      setDeals([]);
      setFilteredDeals([]);
    } else {
      const rows = data || [];
      setDeals(rows);
      setFilteredDeals(rows);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDeals();
  }, []);

  return {
    deals,
    setDeals,
    filteredDeals,
    setFilteredDeals,
    loading,
    loadDeals,
  };
};
