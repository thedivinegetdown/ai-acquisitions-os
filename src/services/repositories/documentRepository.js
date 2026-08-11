import { supabase } from "../../supabaseClient";
import { safeTrim } from "../../utils/text";
import {
  normalizeRepositoryListLimit,
  REPOSITORY_LIST_LIMIT,
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";
import { addCurrentOrganizationOwnership } from "../organizations";

export async function listDocumentsByDeal(
  dealId,
  { limit = REPOSITORY_LIST_LIMIT } = {}
) {
  if (!dealId) {
    return repositorySuccess([]);
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(normalizeRepositoryListLimit(limit));

    if (error) throw error;

    return repositorySuccess(data || []);
  }, "Could not load documents.");
}

export async function createDocument(document) {
  const payload = {
    deal_id: document?.deal_id,
    doc_type: safeTrim(document?.doc_type) || "Other",
    notes: safeTrim(document?.notes) || null,
    title: safeTrim(document?.title),
    url: safeTrim(document?.url) || null,
  };

  if (!payload.deal_id || !payload.title) {
    return repositoryFailure(
      "Missing document deal ID or title.",
      "Could not save document."
    );
  }

  return runRepositoryOperation(async () => {
    const ownedPayload = await addCurrentOrganizationOwnership(payload);
    const { data, error } = await supabase
      .from("documents")
      .insert([ownedPayload])
      .select()
      .limit(1);

    if (error) throw error;

    return repositorySuccess(data?.[0] || ownedPayload);
  }, "Could not save document.");
}
