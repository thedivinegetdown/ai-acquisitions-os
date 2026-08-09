import { describe, expect, it } from "vitest";
import {
  EVIDENCE_CONFLICT_STATES,
  EVIDENCE_CONTRACT_VERSION,
  EVIDENCE_EXTRACTION_METHODS,
  EVIDENCE_FRESHNESS_STATES,
  EVIDENCE_LIMITATION_CODES,
  EVIDENCE_RELATIONSHIPS,
  EVIDENCE_RULESET_VERSION,
  EVIDENCE_SOURCE_KINDS,
  EVIDENCE_STATUSES,
  EVIDENCE_VERIFICATION_STATES,
  buildEvidenceCoverage,
  buildEvidenceRegistry,
  createCanonicalEvidenceId,
  evaluateEvidenceRequirements,
  normalizeCanonicalEvidence,
  traceEvidenceAncestors,
  validateCanonicalEvidence,
} from "../index";

function evidence(overrides = {}) {
  return {
    sourceType: "crm-current-state",
    sourceSystem: "Deal record",
    sourceRecordId: "deal-1",
    sourceField: "asking_price",
    relatedCanonicalField: "deal.askingPrice",
    valueSummary: "$100,000",
    normalizedValue: 100000,
    relationship: EVIDENCE_RELATIONSHIPS.SUPPORTS,
    extractionMethod: EVIDENCE_EXTRACTION_METHODS.DIRECT_FIELD,
    organizationId: "org-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

describe("Evidence and Provenance contracts", () => {
  it("publishes the v1 contract, ruleset, and canonical registries", () => {
    expect(EVIDENCE_CONTRACT_VERSION).toBe("evidence-provenance-contract-v1");
    expect(EVIDENCE_RULESET_VERSION).toBe("evidence-provenance-ruleset-v1");
    expect(Object.values(EVIDENCE_SOURCE_KINDS)).toContain("land-comparable-sale");
    expect(Object.values(EVIDENCE_RELATIONSHIPS)).toEqual(["supports", "challenges", "contextual", "unknown"]);
    expect(Object.values(EVIDENCE_VERIFICATION_STATES)).toContain("verification-required");
    expect(Object.values(EVIDENCE_CONFLICT_STATES)).toContain("resolved-explicitly");
    expect(Object.values(EVIDENCE_FRESHNESS_STATES)).toEqual(["current", "stale", "unknown", "not-applicable"]);
    expect(Object.values(EVIDENCE_STATUSES)).toEqual(["usable", "limited", "unavailable"]);
  });

  it("preserves an existing ID and otherwise generates a stable source ID", () => {
    const expected = createCanonicalEvidenceId(evidence());
    expect(expected).toBe("evidence:crm-current-state:Deal%20record:deal-1:asking_price");
    expect(normalizeCanonicalEvidence(evidence()).evidenceId).toBe(expected);
    expect(normalizeCanonicalEvidence(evidence({ evidenceId: "evidence-existing" })).evidenceId).toBe("evidence-existing");
  });

  it("normalizes bounded primitive values without inventing timestamps or tenant context", () => {
    const normalized = normalizeCanonicalEvidence(evidence({
      normalizedValue: false,
      sourceTimestamp: "bad-date",
      organizationId: null,
      tenantId: null,
    }));
    expect(normalized.normalizedValue).toBe(false);
    expect(normalized.sourceTimestamp).toBeNull();
    expect(normalized.observedTimestamp).toBeNull();
    expect(normalized.organizationId).toBeNull();
    expect(normalized.tenantId).toBeNull();
    expect(normalizeCanonicalEvidence(evidence({ normalizedValue: { unsafe: true } })).normalizedValue).toBeNull();
    expect(normalizeCanonicalEvidence(evidence({ comparisonType: "date", normalizedValue: "2026-08-01" })).normalizedValue).toBe("2026-08-01T00:00:00.000Z");
    expect(normalizeCanonicalEvidence(evidence({ comparisonType: "date", normalizedValue: "not-a-date" })).normalizedValue).toBeNull();
    expect(normalizeCanonicalEvidence(evidence({ comparisonType: "money", normalizedValue: "$100,000" })).normalizedValue).toBe(100000);
  });

  it("normalizes source aliases while unknown sources remain unknown", () => {
    expect(normalizeCanonicalEvidence(evidence({ sourceType: "crm-residential-fact" })).sourceKind).toBe(EVIDENCE_SOURCE_KINDS.COMPATIBILITY);
    expect(normalizeCanonicalEvidence(evidence({ sourceType: "document-record" })).sourceKind).toBe(EVIDENCE_SOURCE_KINDS.DOCUMENT);
    expect(normalizeCanonicalEvidence(evidence({ sourceType: "mystery-source" })).sourceKind).toBe(EVIDENCE_SOURCE_KINDS.UNKNOWN);
  });

  it("never infers verification or freshness from provider, document, timestamps, or agreement", () => {
    const provider = normalizeCanonicalEvidence(evidence({ sourceType: "provider-record", sourceTimestamp: "2026-08-01T00:00:00Z" }));
    const document = normalizeCanonicalEvidence(evidence({ sourceType: "document-record" }));
    expect(provider.verificationState).toBe(EVIDENCE_VERIFICATION_STATES.UNKNOWN);
    expect(provider.freshnessState).toBe(EVIDENCE_FRESHNESS_STATES.UNKNOWN);
    expect(document.verificationState).toBe(EVIDENCE_VERIFICATION_STATES.UNKNOWN);
  });

  it("marks compatibility and contextual Evidence limited without calling it unreliable", () => {
    const compatibility = normalizeCanonicalEvidence(evidence({ compatibility: true }));
    const contextual = normalizeCanonicalEvidence(evidence({ relationship: EVIDENCE_RELATIONSHIPS.CONTEXTUAL }));
    expect(compatibility.evidenceStatus).toBe(EVIDENCE_STATUSES.LIMITED);
    expect(compatibility.limitationCodes).toContain(EVIDENCE_LIMITATION_CODES.COMPATIBILITY_ONLY);
    expect(contextual.evidenceStatus).toBe(EVIDENCE_STATUSES.LIMITED);
    expect(compatibility).not.toHaveProperty("reliabilityScore");
    expect(normalizeCanonicalEvidence(evidence({ trustLevel: "operator-reviewed" })).legacySourceMetadata).toMatchObject({ canonical: false, trustLevel: "operator-reviewed" });
  });

  it("rejects malformed identity and reports explicit self-reference", () => {
    expect(normalizeCanonicalEvidence({ sourceType: "manual-entry" })).toBeNull();
    expect(normalizeCanonicalEvidence({
      evidenceId: "evidence:legacy-partial",
      sourceType: "manual-entry",
      relatedCanonicalField: "property.condition",
      valueSummary: "Needs work",
      relationship: "supports",
    })).toMatchObject({ evidenceStatus: "limited", sourceKind: "manual-entry" });
    const id = createCanonicalEvidenceId(evidence());
    expect(validateCanonicalEvidence(evidence({ derivedFromEvidenceIds: [id] }))).toMatchObject({ valid: false });
  });
});

describe("Evidence registry, coverage, requirements, and lineage", () => {
  it("indexes relationships and descriptive coverage without percentages or grades", () => {
    const registry = buildEvidenceRegistry({
      context: { organizationId: "org-1", tenantId: "tenant-1" },
      evidenceReferences: [
        evidence(),
        evidence({ evidenceId: "challenge-1", relationship: EVIDENCE_RELATIONSHIPS.CHALLENGES, normalizedValue: 120000 }),
        evidence({ evidenceId: "context-1", relationship: EVIDENCE_RELATIONSHIPS.CONTEXTUAL, sourceField: "note" }),
      ],
    });
    const coverage = buildEvidenceCoverage(registry);
    expect(registry.counts).toMatchObject({ total: 3, supporting: 1, challenging: 1, contextual: 1 });
    expect(coverage.coverageByCanonicalField["deal.askingPrice"]).toMatchObject({ supportingCount: 1, challengingCount: 1, contextualCount: 1 });
    expect(coverage).not.toHaveProperty("percentage");
    expect(coverage).not.toHaveProperty("reliabilityGrade");
  });

  it("deduplicates stable IDs and warns rather than overwriting material disagreement", () => {
    const registry = buildEvidenceRegistry({
      evidenceReferences: [evidence(), evidence({ normalizedValue: 125000 })],
    });
    expect(registry.evidenceRecords).toHaveLength(1);
    expect(registry.evidenceRecords[0].normalizedValue).toBe(100000);
    expect(registry.warnings.join(" ")).toContain("disagreeing metadata");
  });

  it("adapts active RDI-02 conflict Evidence as challenging without selecting truth", () => {
    const source = normalizeCanonicalEvidence(evidence());
    const registry = buildEvidenceRegistry({
      evidenceReferences: [source],
      conflictReadModel: { activeConflicts: [{ evidenceIds: [source.evidenceId] }] },
    });
    expect(registry.evidenceRecords[0]).toMatchObject({
      conflictState: EVIDENCE_CONFLICT_STATES.CONFLICTING,
      relationship: EVIDENCE_RELATIONSHIPS.CHALLENGES,
    });
    expect(registry.evidenceRecords[0]).not.toHaveProperty("selectedValue");
  });

  it("excludes cross-tenant Evidence without leaking its source identity", () => {
    const registry = buildEvidenceRegistry({
      context: { organizationId: "org-1", tenantId: "tenant-1" },
      evidenceReferences: [evidence(), evidence({ sourceRecordId: "secret-record", tenantId: "tenant-2", valueSummary: "secret value" })],
    });
    expect(registry.evidenceRecords).toHaveLength(1);
    expect(JSON.stringify(registry)).not.toContain("secret-record");
    expect(JSON.stringify(registry)).not.toContain("secret value");
    expect(registry.warnings).toContain("Cross-tenant Evidence was excluded from the registry.");
  });

  it("retains only explicitly local compatibility Evidence when scoped input lacks tenant metadata", () => {
    const registry = buildEvidenceRegistry({
      context: { organizationId: "org-1", tenantId: "tenant-1" },
      evidenceReferences: [
        evidence({ evidenceId: "unscoped", organizationId: null, tenantId: null, compatibility: false }),
        evidence({ evidenceId: "local-compatibility", organizationId: null, tenantId: null, compatibility: true }),
      ],
    });
    expect(registry.evidenceRecords.map((item) => item.evidenceId)).toEqual(["local-compatibility"]);
    expect(registry.evidenceRecords[0].evidenceStatus).toBe("limited");
    expect(registry.warnings).toContain("Unscoped Evidence was excluded from the tenant-scoped registry.");
  });

  it("evaluates required direct support separately from contextual, limited, and challenging Evidence", () => {
    const registry = buildEvidenceRegistry({ evidenceReferences: [evidence()] });
    const result = evaluateEvidenceRequirements({
      registry,
      requirements: [
        { requirementId: "asking", canonicalField: "deal.askingPrice" },
        { requirementId: "arv", canonicalField: "property.afterRepairValue" },
      ],
    });
    expect(result.satisfiedRequirements.map((item) => item.requirementId)).toEqual(["asking"]);
    expect(result.unsatisfiedRequirements.map((item) => item.requirementId)).toEqual(["arv"]);
  });

  it("traces bounded lineage, deduplicates parents, and warns on cycles", () => {
    const a = evidence({ evidenceId: "a", derivedFromEvidenceIds: ["b", "b"] });
    const b = evidence({ evidenceId: "b", sourceField: "arv", derivedFromEvidenceIds: ["a"] });
    const registry = buildEvidenceRegistry({ evidenceReferences: [a, b] });
    const lineage = traceEvidenceAncestors(registry, "a");
    expect(lineage.ancestors.map((item) => item.evidenceId)).toEqual(["b"]);
    expect(lineage.warnings.join(" ")).toContain("cycle");
  });
});
