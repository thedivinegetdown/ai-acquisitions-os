import { supabase } from "../../supabaseClient";
import { safeTrim } from "../../utils/text";
import {
  normalizeRepositoryListLimit,
  REPOSITORY_LIST_LIMIT,
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";
import { addCurrentOrganizationOwnership } from "../organizations";

export async function listCompsByDeal(
  dealId,
  { limit = REPOSITORY_LIST_LIMIT } = {}
) {
  if (!dealId) {
    return repositorySuccess([]);
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("comps")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(normalizeRepositoryListLimit(limit));

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not load comps.");
}

export async function createComp(comp) {
  const payload = {
    address: safeTrim(comp?.address),
    baths: comp?.baths === "" || comp?.baths == null ? null : Number(comp.baths),
    beds: comp?.beds === "" || comp?.beds == null ? null : Number(comp.beds),
    deal_id: comp?.deal_id,
    sale_price:
      comp?.sale_price === "" || comp?.sale_price == null
        ? null
        : Number(comp.sale_price),
    sqft: comp?.sqft === "" || comp?.sqft == null ? null : Number(comp.sqft),
  };

  if (!payload.deal_id || !payload.address) {
    return repositoryFailure("Missing comp deal ID or address.", "Could not save comp.");
  }

  return runRepositoryOperation(async () => {
    const ownedPayload = await addCurrentOrganizationOwnership(payload);
    const { data, error } = await supabase
      .from("comps")
      .insert([ownedPayload])
      .select()
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || ownedPayload);
  }, "Could not save comp.");
}
