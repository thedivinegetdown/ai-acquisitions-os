// DI-06 is a pure in-memory orchestration boundary. RDI-04 evaluates freshness
// before this function; evaluation clock ticks are not themselves material facts.
const TRANSIENT_KEYS = new Set(["evaluatedTimestamp", "generatedTimestamp", "ageDays", "evaluatedAgeDays"]);
export const RECALCULATION_CONTRACT_VERSION = "recommendation-recalculation-v1";

export function pickDecisionFields(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value?.[key] ?? null]));
}

export function recommendationEvidenceInput(evidence, freshnessReadModel) {
  return {
    ...pickDecisionFields(evidence, ["evidenceId", "relatedCanonicalField", "sourceKind", "sourceSystem", "sourceRecordId", "sourceField", "normalizedValue", "valueSummary", "verificationState", "conflictState", "freshnessState", "relationship", "derivedFromEvidenceIds"]),
    // RDI-04 excludes compatibility record update time; do not turn a note edit
    // into a material source-time change at the orchestration boundary.
    sourceTimestamp: freshnessReadModel.assessmentsByEvidenceId[evidence.evidenceId]?.selectedTimestamp ?? null,
  };
}

export function recommendationStrategyInput(strategy) {
  if (!strategy) return null;
  const quantitative = (result) => result ? Object.fromEntries(Object.entries(result).filter(([key, value]) =>
    (!value || typeof value !== "object" || ["inputEvidenceIds", "blockingIssueIds"].includes(key)) &&
    !["evaluatedTimestamp", "explanation", "sourceTimestamp"].includes(key))) : null;
  return { eligible: strategy.eligible, reviewGuidance: strategy.reviewGuidance,
    underwriting: quantitative(strategy.underwriting), valuation: quantitative(strategy.valuation),
    pursuitScore: quantitative(strategy.pursuitScoreResult) };
}

export function canonicalFingerprint(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalFingerprint).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => !TRANSIENT_KEYS.has(key)).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalFingerprint(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

export function refreshCanonicalRecommendation({ categories, previous, available = true, compute }) {
  if (!available) return { contractVersion: RECALCULATION_CONTRACT_VERSION, state: "unavailable", changedCategories: [], explanation: "Canonical inputs are unavailable.", selection: compute() };
  const fingerprints = Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, canonicalFingerprint(value)]));
  const changedCategories = Object.keys(fingerprints).filter((key) => fingerprints[key] !== previous?.fingerprints?.[key]);
  const unchanged = previous?.contractVersion === RECALCULATION_CONTRACT_VERSION && previous?.selection && changedCategories.length === 0;
  return {
    contractVersion: RECALCULATION_CONTRACT_VERSION,
    state: unchanged ? "unchanged" : "recalculated",
    fingerprints,
    changedCategories,
    explanation: unchanged ? "Recommendation-relevant canonical inputs are unchanged." : `Decision refreshed: ${changedCategories.join(", ")}.`,
    selection: unchanged ? previous.selection : compute(),
  };
}
