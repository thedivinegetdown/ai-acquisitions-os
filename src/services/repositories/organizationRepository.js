import { supabase } from "../../supabaseClient";
import {
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";

export async function listCurrentUserMemberships(userId) {
  if (!userId) {
    return repositoryFailure(
      "Missing authenticated user ID.",
      "Could not load organization membership."
    );
  }

  return runRepositoryOperation(async () => {
    const { data, error } = await supabase
      .from("organization_memberships")
      .select(
        "organization_id, role, status, created_at, organization:organizations!organization_memberships_organization_id_fkey(id, name, slug, status)"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("organization_id", { ascending: true })
      .limit(2);

    if (error) throw error;
    return repositorySuccess(data || []);
  }, "Could not load organization membership.");
}
