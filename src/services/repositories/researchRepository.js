import { supabase } from "../../supabaseClient";
import { requireActiveOrganizationContext } from "../organizations";
import { buildResearchMutation, RESEARCH_FIELDS } from "../research-intelligence/researchResolutionService";
import { buildSupportingEvidenceAppendMutation } from "../research-intelligence/supportingEvidenceService";
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

export async function saveSupportingEvidenceCommand(deal, command) {
  return saveSupportingEvidenceBatchCommand(deal, [command]);
}

// Validate the complete reviewed batch before one optimistic, tenant-bound write.
// A stale revision or any invalid item leaves all existing evidence untouched.
export async function saveSupportingEvidenceBatchCommand(deal, commands) {
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    if (deal.organization_id !== context.organizationId) {
      throw new Error("The deal is outside the active organization.");
    }
    if (!Array.isArray(commands) || !commands.length) throw new Error("Reviewed evidence is required.");
    let updated = deal;
    for (const command of commands) {
      updated = { ...updated, ...buildSupportingEvidenceAppendMutation({
        deal: updated, command, actorReference: context.userId,
      }) };
    }
    const payload = { research_evidence: updated.research_evidence, research_revision: updated.research_revision };
    let query = supabase.from("deals").update(payload)
      .eq("id", deal.id).eq("organization_id", context.organizationId)
      .eq("research_revision", deal.research_revision || 0);
    if (deal.updated_at) query = query.eq("updated_at", deal.updated_at);
    const { data, error } = await query.select().limit(1);
    if (error) throw error;
    if (!data?.[0]) {
      throw new Error("The deal changed or no longer exists. Reload before adding evidence.");
    }
    return repositorySuccess(data[0]);
  }, "Could not save supporting evidence. Reload the deal and try again.");
}
