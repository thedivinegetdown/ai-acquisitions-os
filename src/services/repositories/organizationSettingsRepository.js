import { supabase } from "../../supabaseClient";
import { requireActiveOrganizationContext } from "../organizations";
import {
  repositoryFailure,
  repositorySuccess,
  runRepositoryOperation,
} from "./repositoryResult";

export const ORGANIZATION_SETTINGS_FIELDS = [
  "default_market",
  "default_lead_source",
  "default_pipeline_stage",
  "default_follow_up_cadence",
  "default_offer_formula",
  "default_assignment_fee_target",
  "default_repair_estimate_buffer",
  "default_timezone",
];

function pickSettings(settings = {}) {
  return Object.fromEntries(
    ORGANIZATION_SETTINGS_FIELDS
      .filter((field) => Object.hasOwn(settings, field))
      .map((field) => [field, settings[field]])
  );
}

export async function loadOrganizationSettings() {
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("organization_settings")
      .select(`organization_id, ${ORGANIZATION_SETTINGS_FIELDS.join(", ")}, updated_at`)
      .eq("organization_id", organizationId)
      .limit(1);
    if (error) throw error;
    if (!data?.[0]) {
      return repositoryFailure(
        "Organization settings are not configured.",
        "Could not load organization settings."
      );
    }
    return repositorySuccess(data[0]);
  }, "Could not load organization settings.");
}

export async function saveOrganizationSettings(settings = {}) {
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const payload = pickSettings(settings);
    if (Object.keys(payload).length === 0) {
      return repositoryFailure("No supported settings supplied.", "Could not save organization settings.");
    }
    const { data, error } = await supabase
      .from("organization_settings")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .select()
      .limit(1);
    if (error) throw error;
    if (!data?.[0]) {
      return repositoryFailure(
        "Settings were not found in the active organization or the caller is not its owner.",
        "Could not save organization settings."
      );
    }
    return repositorySuccess(data[0]);
  }, "Could not save organization settings.");
}

export async function loadOrganizationProviderPolicies() {
  return runRepositoryOperation(async () => {
    const { organizationId } = await requireActiveOrganizationContext();
    const { data, error } = await supabase
      .from("organization_provider_policies")
      .select("provider, enabled, monthly_request_cap, max_prompt_characters, updated_at")
      .eq("organization_id", organizationId)
      .order("provider", { ascending: true });
    if (error) throw error;
    return repositorySuccess(data || []);
  }, "Could not load provider availability.");
}
