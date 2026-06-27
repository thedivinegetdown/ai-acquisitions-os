import { useMemo } from "react";
import { buildExecutiveDashboard } from "../services";

export function useExecutiveDashboard(deals = []) {
  return useMemo(() => buildExecutiveDashboard(deals), [deals]);
}
