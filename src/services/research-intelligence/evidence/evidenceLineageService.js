import { uniqueStrings } from "../../../utils/text";
import { EVIDENCE_LIMITS } from "./evidenceContracts";

function adjacency(records) {
  return new Map(records.map((record) => [record.evidenceId, uniqueStrings([...(record.parentEvidenceIds || []), ...(record.derivedFromEvidenceIds || [])])]));
}

export function traceEvidenceAncestors(registry = {}, evidenceId, options = {}) {
  const maximumDepth = Math.min(EVIDENCE_LIMITS.LINEAGE_DEPTH, Math.max(1, Number(options.maximumDepth) || EVIDENCE_LIMITS.LINEAGE_DEPTH));
  const maximumNodes = Math.min(EVIDENCE_LIMITS.LINEAGE_NODES, Math.max(1, Number(options.maximumNodes) || EVIDENCE_LIMITS.LINEAGE_NODES));
  const graph = adjacency(registry.evidenceRecords || []);
  const warnings = [];
  const ancestors = [];
  const visited = new Set([evidenceId]);
  const queue = (graph.get(evidenceId) || []).map((id) => ({ id, depth: 1 }));
  while (queue.length && ancestors.length < maximumNodes) {
    const current = queue.shift();
    if (visited.has(current.id)) {
      warnings.push(`Evidence lineage cycle detected at ${current.id}.`);
      continue;
    }
    visited.add(current.id);
    const record = registry.evidenceById?.[current.id];
    if (record) ancestors.push({ evidenceId: current.id, depth: current.depth, record });
    if (current.depth < maximumDepth) {
      (graph.get(current.id) || []).forEach((id) => queue.push({ id, depth: current.depth + 1 }));
    }
  }
  if (queue.length) warnings.push("Evidence lineage traversal reached its configured bound.");
  return { evidenceId, ancestors, warnings: uniqueStrings(warnings) };
}

export function buildDecisionOutputLineage({ readinessResult, residentialStrategyResult, pursuitScoreResult, vacantLandStrategyResult } = {}) {
  const outputs = [
    residentialStrategyResult?.underwriting ? { outputId: "residential-underwriting", label: "Residential underwriting", derivedFromEvidenceIds: residentialStrategyResult.underwriting.inputEvidenceIds || [] } : null,
    vacantLandStrategyResult?.valuation ? { outputId: "vacant-land-valuation", label: "Vacant Land valuation context", derivedFromEvidenceIds: vacantLandStrategyResult.valuation.inputEvidenceIds || [] } : null,
    Number.isFinite(pursuitScoreResult?.score) ? { outputId: "pursuit-score", label: "Pursuit Score", derivedFromEvidenceIds: pursuitScoreResult.evidenceReferenceIds || [] } : null,
    readinessResult ? { outputId: "offer-readiness", label: "Offer Readiness", derivedFromEvidenceIds: readinessResult.evidenceIds || [] } : null,
  ].filter(Boolean).map((output) => ({ ...output, derivedFromEvidenceIds: uniqueStrings(output.derivedFromEvidenceIds).slice(0, EVIDENCE_LIMITS.REFERENCES) }));
  return { outputs };
}
