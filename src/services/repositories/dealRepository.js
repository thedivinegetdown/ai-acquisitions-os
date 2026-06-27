import { supabase } from "../../supabaseClient";
import { safeTrim } from "../../utils/text";
import {
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";

const DEAL_SELECT = "*";

export async function listDeals() {
  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .order("property_address", { ascending: true });

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not load deals.");
}

export async function findDealByPhone(phone) {
  const normalizedPhone = safeTrim(phone);

  if (!normalizedPhone) {
    return repositorySuccess(null);
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("phone", normalizedPhone)
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || null);
  }, "Could not load linked deal.");
}

export async function updateDeal(dealId, payload) {
  if (!dealId) {
    return repositoryFailure("Missing deal ID.", "Could not update deal.");
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("deals")
      .update(payload)
      .eq("id", dealId)
      .select()
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || null);
  }, "Could not update deal.");
}

export async function updateDeals(dealIds = [], payload) {
  const ids = dealIds.filter(Boolean);

  if (ids.length === 0) {
    return repositoryFailure("Missing deal IDs.", "Could not update deals.");
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("deals")
      .update(payload)
      .in("id", ids)
      .select();

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not update deals.");
}
