import { describe, expect, it } from "vitest";
import {
  INFORMATION_STATES,
  MISSING_INFORMATION_CONTRACT_VERSION,
  MISSING_INFORMATION_CRITICALITIES,
  MISSING_INFORMATION_LIMITS,
  VALUE_PRESENCE_POLICIES,
  evaluateValuePresence,
  normalizeMissingInformationItem,
  normalizeMissingInformationProfile,
  normalizeMissingInformationRequirement,
  normalizeStrategyLimitation,
  validateMissingInformationProfile,
} from "../index";

describe("Missing Information contracts", () => {
  it("publishes the approved version, states, and criticalities", () => {
    expect(MISSING_INFORMATION_CONTRACT_VERSION).toBe(
      "missing-information-contract-v1"
    );
    expect(Object.values(INFORMATION_STATES)).toEqual(
      expect.arrayContaining([
        "present",
        "missing",
        "unknown",
        "unverified",
        "conflicting",
        "stale",
        "unavailable",
        "not-applicable",
      ])
    );
    expect(Object.values(MISSING_INFORMATION_CRITICALITIES)).toEqual([
      "blocking",
      "advisory",
      "informational",
    ]);
  });

  it.each([
    [VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT, "value", "present"],
    [VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT, "   ", "missing"],
    [VALUE_PRESENCE_POLICIES.NON_EMPTY_TEXT, "unknown", "unknown"],
    [VALUE_PRESENCE_POLICIES.ANY_FINITE_NUMBER, 0, "present"],
    [VALUE_PRESENCE_POLICIES.POSITIVE_NUMBER, 0, "missing"],
    [VALUE_PRESENCE_POLICIES.BOOLEAN_INCLUDING_FALSE, false, "present"],
    [VALUE_PRESENCE_POLICIES.VALID_DATE, "not-a-date", "missing"],
    [VALUE_PRESENCE_POLICIES.VALID_DATE, "2026-08-05", "present"],
    [VALUE_PRESENCE_POLICIES.NON_EMPTY_COLLECTION, [], "missing"],
    [VALUE_PRESENCE_POLICIES.NON_EMPTY_COLLECTION, ["fact"], "present"],
    [VALUE_PRESENCE_POLICIES.EXPLICIT_KNOWN_STATUS, "confirmed", "present"],
    [VALUE_PRESENCE_POLICIES.EXPLICIT_KNOWN_STATUS, false, "present"],
    [VALUE_PRESENCE_POLICIES.LEGACY_COMPATIBILITY_VALUE, false, "missing"],
  ])("evaluates %s without generic truthiness", (policy, value, state) => {
    expect(evaluateValuePresence(policy, value).state).toBe(state);
  });

  it("requires evidence only for the evidence-backed policy", () => {
    expect(
      evaluateValuePresence(
        VALUE_PRESENCE_POLICIES.EVIDENCE_BACKED_VALUE,
        "recorded"
      ).state
    ).toBe(INFORMATION_STATES.UNVERIFIED);
    expect(
      evaluateValuePresence(
        VALUE_PRESENCE_POLICIES.EVIDENCE_BACKED_VALUE,
        "recorded",
        { evidenceReferenceIds: ["evidence-1"] }
      ).state
    ).toBe(INFORMATION_STATES.PRESENT);
  });

  it("normalizes a requirement and preserves its rule ownership", () => {
    const requirement = normalizeMissingInformationRequirement({
      requirementId: "legal-access",
      profileId: "land-v1",
      canonicalField: "property.legalAccess",
      acceptedFieldAliases: ["legal_access"],
      label: "Legal access",
      criticality: "blocking",
      blockingBehavior: true,
      valuePresencePolicy: "explicit-known-status-value",
      sellerAnswerable: true,
      sellerQuestion: "Do you know whether the parcel has legal access?",
      relatedSection: "documents",
    });

    expect(requirement).toMatchObject({
      contractVersion: MISSING_INFORMATION_CONTRACT_VERSION,
      criticality: "blocking",
      blockingBehavior: true,
      relatedSection: "documents",
    });
  });

  it("bounds profile requirements and reports malformed profiles", () => {
    const profile = normalizeMissingInformationProfile({
      profileId: "bounded-profile",
      label: "Bounded",
      requirements: Array.from(
        { length: MISSING_INFORMATION_LIMITS.REQUIREMENTS_PER_PROFILE + 5 },
        (_, index) => ({
          requirementId: `requirement-${index}`,
          canonicalField: `field.${index}`,
          label: `Requirement ${index}`,
        })
      ),
    });

    expect(profile.requirements).toHaveLength(
      MISSING_INFORMATION_LIMITS.REQUIREMENTS_PER_PROFILE
    );
    expect(validateMissingInformationProfile({})).toMatchObject({ valid: false });
  });

  it("preserves supplied tenant context and never substitutes a source timestamp", () => {
    const item = normalizeMissingInformationItem({
      itemId: "item-1",
      requirementId: "parcel-id",
      label: "Parcel identity",
      organizationId: "org-1",
      tenantId: "tenant-1",
      state: "missing",
      evaluatedTimestamp: "2026-08-05T15:00:00Z",
    });

    expect(item).toMatchObject({
      organizationId: "org-1",
      tenantId: "tenant-1",
      sourceTimestamp: null,
      evaluatedTimestamp: "2026-08-05T15:00:00.000Z",
    });
  });

  it("normalizes limitations separately from information items", () => {
    expect(
      normalizeStrategyLimitation({
        limitationId: "limitation-land",
        type: "strategy-not-implemented",
        label: "Vacant Land Strategy is not yet implemented.",
      })
    ).toMatchObject({
      type: "strategy-not-implemented",
      label: "Vacant Land Strategy is not yet implemented.",
    });
    expect(normalizeMissingInformationItem({})).toBeNull();
  });
});
