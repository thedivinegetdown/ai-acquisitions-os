import { supabase } from "../../supabaseClient";
import {
  buildDecisionMemoryHistory,
  buildOwnerDecisionPayload,
  buildRecommendationSnapshotPayload,
  DECISION_MEMORY_HISTORY_LIMIT,
} from "../decision-intelligence/decisionMemoryService";
import { requireActiveOrganizationContext } from "../organizations";
import { repositoryFailure, repositorySuccess, runRepositoryOperation } from "./repositoryResult";

const SOURCE_LIMIT = 100;

function scopedList(table, dealId, organizationId, orderColumn, limit) {
  return supabase
    .from(table)
    .select("*")
    .eq("deal_id", dealId)
    .eq("organization_id", organizationId)
    .order(orderColumn, { ascending: false })
    .limit(limit);
}

export async function loadDecisionMemoryByDeal(dealId, { limit = DECISION_MEMORY_HISTORY_LIMIT } = {}) {
  if (!dealId) return repositorySuccess(buildDecisionMemoryHistory({ dealId: null }));
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const [snapshotResult, decisionResult, offerResult, closingResult] = await Promise.all([
      scopedList("decision_recommendation_snapshots", dealId, organizationId, "snapshot_number", limit),
      scopedList("decision_owner_decisions", dealId, organizationId, "decided_at", SOURCE_LIMIT),
      scopedList("offer_revisions", dealId, organizationId, "revision_number", SOURCE_LIMIT),
      scopedList("deal_closing_revisions", dealId, organizationId, "revision_number", SOURCE_LIMIT),
    ]);
    const failed = [snapshotResult, decisionResult, offerResult, closingResult].find((result) => result.error);
    if (failed) throw failed.error;

    return repositorySuccess(buildDecisionMemoryHistory({
      closingRevisions: closingResult.data || [],
      dealId,
      decisions: decisionResult.data || [],
      limit,
      offerRevisions: offerResult.data || [],
      organizationId,
      snapshots: snapshotResult.data || [],
    }));
  }, "Could not load Decision Memory.");
}

export async function appendRecommendationSnapshot({ deal, readModel } = {}) {
  if (!deal?.id) return repositoryFailure("Missing deal ID.", "Could not record the recommendation snapshot.");
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    const payload = buildRecommendationSnapshotPayload({
      actorReference: context.userId,
      deal,
      readModel,
    });
    if (!payload) {
      return repositorySuccess(null, { skipped: true, reason: "not-a-meaningful-recalculation" });
    }
    if (payload.organization_id !== context.organizationId) {
      throw new Error("Recommendation organization does not match the active organization.");
    }

    const { data, error } = await supabase
      .from("decision_recommendation_snapshots")
      .insert(payload)
      .select()
      .limit(1);
    if (error) throw error;
    return repositorySuccess(data?.[0] || null, {
      deduplicated: !data?.[0],
    });
  }, "Could not record the recommendation snapshot.");
}

export async function appendOwnerDecision({ alternative, decisionType, reason, snapshot } = {}) {
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    if (!["owner", "admin"].includes(context.role)) {
      throw new Error("Only an owner or admin can record an owner decision.");
    }
    if (snapshot?.organization_id !== context.organizationId) {
      throw new Error("Recommendation organization does not match the active organization.");
    }
    const payload = buildOwnerDecisionPayload({
      actorReference: context.userId,
      alternative,
      decisionType,
      reason,
      snapshot,
    });
    const { data, error } = await supabase
      .from("decision_owner_decisions")
      .insert(payload)
      .select()
      .limit(1);
    if (error) throw error;
    const record = data?.[0];
    if (!record) throw new Error("The owner decision was not returned after insert.");
    return repositorySuccess(record);
  }, "Could not record the owner decision.");
}
