import { supabase } from "../../supabaseClient";
import { buildClosingCommitments, buildClosingRevisionPayload, projectLatestClosingRevision } from "../transactions/closingLifecycleService";
import { projectLatestOfferRevision } from "../offers/offerLifecycleService";
import { requireActiveOrganizationContext } from "../organizations";
import { repositoryFailure, repositorySuccess, runRepositoryOperation } from "./repositoryResult";
import { listOfferRevisionsByDeal } from "./offerLifecycleRepository";
import { syncLifecycleSellerTasks } from "./sellerTaskRepository";

export async function listClosingRevisionsByDeal(dealId) {
  if (!dealId) return repositorySuccess([]);
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("deal_closing_revisions")
      .select("*")
      .eq("deal_id", dealId)
      .eq("organization_id", organizationId)
      .order("revision_number", { ascending: true });
    if (error) throw error;
    return repositorySuccess(data || []);
  }, "Could not load closing history.");
}

export async function appendClosingRevision({ closing, deal, status } = {}) {
  if (!deal?.id) return repositoryFailure("Missing deal ID.", "Could not record closing revision.");
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    const [offerResult, closingResult] = await Promise.all([
      listOfferRevisionsByDeal(deal.id),
      listClosingRevisionsByDeal(deal.id),
    ]);
    if (!offerResult.success) throw offerResult.error?.cause || new Error(offerResult.error?.message);
    if (!closingResult.success) throw closingResult.error?.cause || new Error(closingResult.error?.message);
    const acceptedOfferRevision = projectLatestOfferRevision(offerResult.data);
    const latestRevision = projectLatestClosingRevision(closingResult.data);
    const payload = buildClosingRevisionPayload({
      acceptedOfferRevision,
      actorReference: context.userId,
      closing,
      deal,
      latestRevision,
      status,
    });
    const { data, error } = await supabase
      .from("deal_closing_revisions")
      .insert({ ...payload, organization_id: context.organizationId })
      .select()
      .limit(1);
    if (error) throw error;
    const record = data?.[0];
    if (!record) throw new Error("Closing revision was not returned after insert.");
    const commitmentResult = await syncLifecycleSellerTasks({
      commitments: buildClosingCommitments(record),
      deal,
      sourceType: "closing-lifecycle",
    });
    return repositorySuccess(record, {
      commitmentWarning: commitmentResult.success ? null : commitmentResult.error?.message,
    });
  }, "Could not record closing revision.");
}
