import { supabase } from "../../supabaseClient";
import {
  normalizeRepositoryListLimit,
  REPOSITORY_LIST_LIMIT,
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";
import {
  requireActiveOrganizationContext,
  stripOrganizationOwnership,
} from "../organizations";

export const SEQUENCE_STEP_PAGE_SIZE = 200;

export async function listSequencesByDeal(
  dealId,
  { limit = REPOSITORY_LIST_LIMIT } = {}
) {
  if (!dealId) {
    return repositorySuccess([]);
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("sequences")
      .select("*")
      .eq("deal_id", dealId)
      .order("step_day", { ascending: true })
      .limit(normalizeRepositoryListLimit(limit));

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not load follow-up sequence.");
}

export async function listSequenceSteps({ pageSize = SEQUENCE_STEP_PAGE_SIZE } = {}) {
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const safePageSize = Math.min(500, Math.max(1, Number(pageSize) || SEQUENCE_STEP_PAGE_SIZE));
    const rows = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("sequences")
        .select("*")
        .eq("organization_id", organizationId)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + safePageSize - 1);

      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < safePageSize) break;
      offset += page.length;
    }

    return repositorySuccess(rows, { pageSize: safePageSize, complete: true });
  }, "Could not load sequence commitments.");
}

export async function createSequenceSteps(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return repositoryFailure("Missing sequence steps.", "Could not create sequence.");
  }

  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const ownedSteps = steps.map((step) => ({
      ...stripOrganizationOwnership(step),
      organization_id: organizationId,
    }));
    const { data, error } = await supabase
      .from("sequences")
      .insert(ownedSteps)
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
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("sequences")
      .update(stripOrganizationOwnership(payload))
      .eq("id", stepId)
      .eq("organization_id", organizationId)
      .select()
      .limit(1);

    if (error) throw error;
    if (!data?.[0]) {
      return repositoryFailure(
        "Sequence step was not found in the active organization.",
        "Could not update sequence."
      );
    }

    return repositorySuccess(data[0]);
  }, "Could not update sequence.");
}
