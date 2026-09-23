import { supabase } from "../../supabaseClient";
import { safeTrim } from "../../utils/text";
import {
  normalizeRepositoryListLimit,
  REPOSITORY_LIST_LIMIT,
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";
import {
  addCurrentOrganizationOwnership,
  requireActiveOrganizationContext,
  stripOrganizationOwnership,
} from "../organizations";

export async function listSellerTasks({ limit = REPOSITORY_LIST_LIMIT } = {}) {
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("seller_tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .order("due_at", { ascending: true })
      .limit(normalizeRepositoryListLimit(limit));

    if (error) throw error;
    return repositorySuccess(data || []);
  }, "Could not load seller tasks.");
}

export async function listSellerTasksByPhone(
  phone,
  { limit = REPOSITORY_LIST_LIMIT } = {}
) {
  const normalizedPhone = safeTrim(phone);

  if (!normalizedPhone) {
    return repositorySuccess([]);
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("seller_tasks")
      .select("*")
      .eq("phone", normalizedPhone)
      .order("status", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(normalizeRepositoryListLimit(limit));

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not load tasks. Apply the seller_tasks migration if needed.");
}

export async function createSellerTask(task) {
  const payload = {
    deal_id: task?.deal_id || null,
    due_at: task?.due_at || null,
    phone: safeTrim(task?.phone),
    status: task?.status || "open",
    title: safeTrim(task?.title),
  };

  if (!payload.phone || !payload.title) {
    return repositoryFailure("Missing task phone or title.", "Could not create task.");
  }

  return runRepositoryOperation(async () => {
    const ownedPayload = await addCurrentOrganizationOwnership(payload);
    const { data, error } = await supabase
      .from("seller_tasks")
      .insert(ownedPayload)
      .select()
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || ownedPayload);
  }, "Could not create task.");
}

export async function updateSellerTask(taskId, payload) {
  if (!taskId) {
    return repositoryFailure("Missing task ID.", "Could not update task.");
  }

  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("seller_tasks")
      .update(stripOrganizationOwnership(payload))
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .select()
      .limit(1);

    if (error) throw error;
    if (!data?.[0]) {
      return repositoryFailure(
        "Task was not found in the active organization.",
        "Could not update task."
      );
    }

    return repositorySuccess(data[0]);
  }, "Could not update task.");
}

export async function syncLifecycleSellerTasks({ commitments = [], deal = {}, sourceType } = {}) {
  if (!deal.id || !sourceType) {
    return repositoryFailure("Missing lifecycle task owner.", "Could not sync lifecycle commitments.");
  }

  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data: existing, error: loadError } = await supabase
      .from("seller_tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("deal_id", deal.id)
      .eq("source_type", sourceType);
    if (loadError) throw loadError;

    const desiredKeys = new Set(commitments.map((commitment) => commitment.sourceKey));
    const stale = (existing || []).filter(
      (task) => !desiredKeys.has(task.source_key) && !["cancelled", "completed"].includes(task.status)
    );
    for (const task of stale) {
      const { error } = await supabase
        .from("seller_tasks")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", task.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    }

    if (commitments.length) {
      const existingByKey = new Map((existing || []).map((task) => [task.source_key, task]));
      const payloads = commitments.map((commitment) => {
        const current = existingByKey.get(commitment.sourceKey);
        const title = safeTrim(commitment.title);
        const dueAt = `${commitment.dueDate}T12:00:00.000Z`;
        const preserveCompletion = current?.status === "completed"
          && String(current.due_at || "").slice(0, 10) === commitment.dueDate
          && current.title === title;
        return {
          organization_id: organizationId,
          deal_id: deal.id,
          phone: safeTrim(deal.phone || deal.seller_phone || deal.phone_number),
          title,
          due_at: dueAt,
          status: preserveCompletion ? "completed" : "open",
          source_type: sourceType,
          source_key: commitment.sourceKey,
          updated_at: preserveCompletion ? current.updated_at : new Date().toISOString(),
        };
      });
      const { error } = await supabase
        .from("seller_tasks")
        .upsert(payloads, { onConflict: "organization_id,deal_id,source_type,source_key" });
      if (error) throw error;
    }

    return repositorySuccess({ activeCount: commitments.length, cancelledCount: stale.length });
  }, "Could not sync lifecycle commitments.");
}
