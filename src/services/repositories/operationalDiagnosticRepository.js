import { supabase } from "../../supabaseClient";
import { requireActiveOrganizationContext } from "../organizations";
import { repositoryFailure, repositorySuccess } from "./repositoryResult";

const ALLOWED_OPERATION_TYPES = new Set([
  "lead-import",
  "today-complete",
  "today-revisit",
]);

const ALLOWED_ERROR_CLASSIFICATIONS = new Set([
  "constraint-rejected",
  "persistence-failed",
  "stale-write",
]);

function boundedReference(value) {
  return String(value || "").trim().slice(0, 120) || null;
}

export async function recordOperationalFailure({
  correlationId,
  errorClassification,
  operationType,
} = {}) {
  if (
    !ALLOWED_OPERATION_TYPES.has(operationType) ||
    !ALLOWED_ERROR_CLASSIFICATIONS.has(errorClassification)
  ) {
    return repositoryFailure(
      "Unsupported operational diagnostic classification.",
      "Could not record operation failure."
    );
  }

  try {
    const { organizationId } = await requireActiveOrganizationContext();
    const payload = {
      organization_id: organizationId,
      operation_type: operationType,
      error_classification: errorClassification,
      correlation_id: boundedReference(correlationId),
      status: "open",
    };
    const { error } = await supabase
      .from("operational_failure_diagnostics")
      .insert(payload);

    if (error) throw error;
    return repositorySuccess({ recorded: true });
  } catch (error) {
    return repositoryFailure(error, "Could not record operation failure.");
  }
}
