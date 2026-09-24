import { supabase } from "../../supabaseClient";
import { requireActiveOrganizationContext } from "../organizations";
import { repositorySuccess, runRepositoryOperation } from "./repositoryResult";

const REPORT_SOURCES = Object.freeze({
  deals: "deals",
  sellerTasks: "seller_tasks",
  sequenceSteps: "sequences",
  offerRevisions: "offer_revisions",
  closingRevisions: "deal_closing_revisions",
  messages: "message_logs",
});
const REPORT_PAGE_SIZE = 500;

async function loadSource(table, organizationId) {
  const records = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + REPORT_PAGE_SIZE - 1);
    if (error) return { data: null, error: error.message || `Could not load ${table}.` };
    const page = data || [];
    records.push(...page);
    if (page.length < REPORT_PAGE_SIZE) break;
    offset += REPORT_PAGE_SIZE;
  }

  return { data: records, error: null };
}

export async function loadOwnerOperatingReportSources() {
  return runRepositoryOperation(async () => {
    const context = await requireActiveOrganizationContext();
    const entries = await Promise.all(
      Object.entries(REPORT_SOURCES).map(async ([source, table]) => [
        source,
        await loadSource(table, context.organizationId),
      ])
    );
    const sources = {};
    const sourceErrors = {};
    entries.forEach(([source, result]) => {
      sources[source] = result.data;
      if (result.error) sourceErrors[source] = result.error;
    });

    return repositorySuccess({
      organizationId: context.organizationId,
      organizationWarning: context.warning,
      sourceErrors,
      sources,
    });
  }, "Could not load the owner operating report.");
}
