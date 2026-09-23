import { supabase } from "../../supabaseClient";
import { requireActiveOrganizationContext } from "../organizations";
import { buildResearchMutation, RESEARCH_FIELDS } from "../research-intelligence/researchResolutionService";
import { repositorySuccess, runRepositoryOperation } from "./repositoryResult";

export async function saveResearchCommand(deal, command) {
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    if (deal.organization_id !== context.organizationId) throw new Error("The deal is outside the active organization.");
    const payload = buildResearchMutation({ deal, command, actorReference: context.userId,
      now: new Date().toISOString() });
    let query = supabase.from("deals").update(payload)
      .eq("id", deal.id).eq("organization_id", context.organizationId)
      .eq("research_revision", deal.research_revision || 0);
    // Also detect writes from existing fact editors which do not use research_revision.
    if (deal.updated_at) query = query.eq("updated_at", deal.updated_at);
    for (const column of RESEARCH_FIELDS.find((entry) => entry.field === command.field).columns) {
      query = deal[column] == null ? query.is(column, null) : query.eq(column, deal[column]);
    }
    const { data, error } = await query.select().limit(1);
    if (error) throw error;
    if (!data?.[0]) throw new Error("The deal changed before this save. Reload and review the current facts.");
    return repositorySuccess(data[0]);
  }, "Could not save research. Reload the deal and try again.");
}
