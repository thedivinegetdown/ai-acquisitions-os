import { supabase } from "../../supabaseClient";
import { safeTrim } from "../../utils/text";
import {
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";
import {
  requireActiveOrganizationContext,
  stripOrganizationOwnership,
} from "../organizations";
import { recordOperationalFailure } from "./operationalDiagnosticRepository";

const DEAL_SELECT = "*";
export const DEAL_PAGE_SIZE = 200;

export async function listDeals() {
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const rows = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("deals")
        .select(DEAL_SELECT)
        .eq("organization_id", organizationId)
        .order("property_address", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + DEAL_PAGE_SIZE - 1);

      if (error) throw error;
      const page = data || [];
      rows.push(...page);
      if (page.length < DEAL_PAGE_SIZE) break;
      offset += page.length;
    }

    return repositorySuccess(rows, {
      pageSize: DEAL_PAGE_SIZE,
      pages: Math.max(1, Math.ceil(rows.length / DEAL_PAGE_SIZE)),
      complete: true,
    });
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
      .update(stripOrganizationOwnership(payload))
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
      .update(stripOrganizationOwnership(payload))
      .in("id", ids)
      .select();

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not update deals.");
}

export async function updateOwnedDeal(dealId, payload, { expectedStage } = {}) {
  if (!dealId) {
    return repositoryFailure("Missing deal ID.", "Could not update deal.");
  }

  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    let query = supabase
      .from("deals")
      .update(stripOrganizationOwnership(payload))
      .eq("id", dealId)
      .eq("organization_id", organizationId);

    if (expectedStage) query = query.eq("stage", expectedStage);

    const { data, error } = await query.select().limit(1);
    if (error) throw error;
    if (!data?.[0]) {
      return repositoryFailure(
        "The deal was not found in the active organization or changed before this update.",
        "Could not update deal."
      );
    }

    return repositorySuccess(data[0]);
  }, "Could not update deal.");
}

export async function persistImportedDeals(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return repositoryFailure("Missing accepted leads.", "Could not import leads.");
  }

  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const results = [];
    const correlationId = `lead-import:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

    for (const record of records) {
      const ownedPayload = {
        ...stripOrganizationOwnership(record.payload || {}),
        organization_id: organizationId,
      };
      const { data, error } = await supabase
        .from("deals")
        .insert(ownedPayload)
        .select()
        .limit(1);

      if (error?.code === "23505") {
        results.push({ rowNumber: record.rowNumber, status: "duplicate" });
      } else if (error) {
        results.push({
          rowNumber: record.rowNumber,
          status: "failed",
          error: "Record was rejected by persistence validation.",
        });
      } else {
        results.push({ rowNumber: record.rowNumber, status: "imported", deal: data?.[0] || ownedPayload });
      }
    }

    const failedCount = results.filter((result) => result.status === "failed").length;
    if (failedCount > 0) {
      await recordOperationalFailure({
        correlationId,
        errorClassification: "persistence-failed",
        operationType: "lead-import",
      });
    }

    return repositorySuccess({
      results,
      importedCount: results.filter((result) => result.status === "imported").length,
      duplicateCount: results.filter((result) => result.status === "duplicate").length,
      failedCount,
      correlationId: failedCount > 0 ? correlationId : null,
    });
  }, "Could not import leads.");
}
