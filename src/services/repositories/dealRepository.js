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
          error: error.message || "Database insert failed.",
        });
      } else {
        results.push({ rowNumber: record.rowNumber, status: "imported", deal: data?.[0] || ownedPayload });
      }
    }

    return repositorySuccess({
      results,
      importedCount: results.filter((result) => result.status === "imported").length,
      duplicateCount: results.filter((result) => result.status === "duplicate").length,
      failedCount: results.filter((result) => result.status === "failed").length,
    });
  }, "Could not import leads.");
}
