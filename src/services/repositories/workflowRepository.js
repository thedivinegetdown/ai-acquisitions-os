import { supabase } from "../../supabaseClient";
import {
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";

export async function listSequencesByDeal(dealId) {
  if (!dealId) {
    return repositorySuccess([]);
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("sequences")
      .select("*")
      .eq("deal_id", dealId)
      .order("step_day", { ascending: true });

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not load follow-up sequence.");
}

export async function createSequenceSteps(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return repositoryFailure("Missing sequence steps.", "Could not create sequence.");
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("sequences")
      .insert(steps)
      .select();

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not create sequence.");
}

export async function updateSequenceStep(stepId, payload) {
  if (!stepId) {
    return repositoryFailure("Missing sequence step ID.", "Could not update sequence.");
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("sequences")
      .update(payload)
      .eq("id", stepId)
      .select()
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || null);
  }, "Could not update sequence.");
}
