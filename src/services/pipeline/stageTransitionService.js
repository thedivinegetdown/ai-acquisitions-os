import { updateOwnedDeal } from "../repositories";
import { createFailure } from "../api/serviceResult";
import {
  getAllowedPipelineStageTransitions,
  normalizePipelineStage,
} from "./pipelineService";

export async function transitionPipelineStage({ dealId, currentStage, targetStage } = {}) {
  if (!dealId) return createFailure("Missing deal ID.", "Could not change stage.");

  const normalizedCurrent = normalizePipelineStage(currentStage);
  const normalizedTarget = normalizePipelineStage(targetStage);
  const allowed = getAllowedPipelineStageTransitions(currentStage);

  if (!normalizedCurrent.known || !normalizedTarget.known || !allowed.includes(normalizedTarget.label)) {
    return createFailure(
      `Invalid pipeline transition from ${normalizedCurrent.sourceLabel || "Unstaged"} to ${
        normalizedTarget.sourceLabel || "Unstaged"
      }.`,
      "Could not change stage."
    );
  }

  return updateOwnedDeal(
    dealId,
    { stage: normalizedTarget.label, updated_at: new Date().toISOString() },
    { expectedStage: normalizedCurrent.label }
  );
}
