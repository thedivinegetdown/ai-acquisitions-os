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
  stripOrganizationOwnership,
} from "../organizations";

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
    const { data, error } = await supabase
      .from("seller_tasks")
      .update(stripOrganizationOwnership(payload))
      .eq("id", taskId)
      .select()
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || null);
  }, "Could not update task.");
}
