import { supabase } from "../../supabaseClient";
import { buildOfferCommitments, buildOfferRevisionPayload, projectLatestOfferRevision } from "../offers/offerLifecycleService";
import { requireActiveOrganizationContext } from "../organizations";
import { repositoryFailure, repositorySuccess, runRepositoryOperation } from "./repositoryResult";
import { syncLifecycleSellerTasks } from "./sellerTaskRepository";

export async function listOfferRevisionsByDeal(dealId) {
  if (!dealId) return repositorySuccess([]);
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("offer_revisions")
      .select("*")
      .eq("deal_id", dealId)
      .eq("organization_id", organizationId)
      .order("revision_number", { ascending: true });
    if (error) throw error;
    return repositorySuccess(data || []);
  }, "Could not load offer history.");
}

export async function appendOfferRevision({ deal, revision, status } = {}) {
  if (!deal?.id) return repositoryFailure("Missing deal ID.", "Could not record offer revision.");
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    const historyResult = await listOfferRevisionsByDeal(deal.id);
    if (!historyResult.success) throw historyResult.error?.cause || new Error(historyResult.error?.message);
    const latestRevision = projectLatestOfferRevision(historyResult.data);
    const payload = buildOfferRevisionPayload({
      actorReference: context.userId,
      deal,
      latestRevision,
      revision,
      status,
    });
    const { data, error } = await supabase
      .from("offer_revisions")
      .insert({ ...payload, organization_id: context.organizationId })
      .select()
      .limit(1);
    if (error) throw error;
    const record = data?.[0];
    if (!record) throw new Error("Offer revision was not returned after insert.");
    const commitmentResult = await syncLifecycleSellerTasks({
      commitments: buildOfferCommitments(record),
      deal,
      sourceType: "offer-lifecycle",
    });
    return repositorySuccess(record, {
      commitmentWarning: commitmentResult.success ? null : commitmentResult.error?.message,
    });
  }, "Could not record offer revision.");
}
