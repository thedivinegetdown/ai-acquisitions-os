import { describe, expect, it } from "vitest";
import { buildAssetStrategyContext } from "../../asset-strategy";
import {
  INFORMATION_STATES,
  MISSING_INFORMATION_LIMITS,
  evaluateMissingInformation,
  toDecisionIssueReferences,
} from "../index";

const EVALUATED_AT = "2026-08-05T15:00:00Z";

function completeResidential(overrides = {}) {
  return {
    id: "deal-1",
    organization_id: "org-1",
    tenant_id: "tenant-1",
    asset_type: "residential-home",
    property_address: "123 Main Street",
    owner_name: "Sam Seller",
    phone: "5551112222",
    stage: "Contacted",
    asking_price: 120000,
    property_condition: "Needs repairs",
    motivation_score: 8,
    seller_timeline: "Within 30 days",
    mortgage_status: "Current",
    repairs_needed: 25000,
    occupancy_status: "Vacant",
    arv: 210000,
    ...overrides,
  };
}

function evaluate(deal, options = {}) {
  return evaluateMissingInformation({
    assetStrategyContext: buildAssetStrategyContext(deal),
    deal,
    evaluatedTimestamp: EVALUATED_AT,
    ...options,
  });
}

describe("Missing Information detection", () => {
  it("evaluates complete residential compatibility facts without scores", () => {
    const result = evaluate(completeResidential());

    expect(result.selectedProfile.label).toBe(
      "Residential Compatibility Requirements"
    );
    expect(result.openItems).toEqual([]);
    expect(result.presentRequirements.length).toBeGreaterThan(0);
    expect(result.evaluatedTimestamp).toBe("2026-08-05T15:00:00.000Z");
    for (const forbidden of [
      "score",
      "percentage",
      "dataReliability",
      "recommendationConfidence",
      "pursuitScore",
    ]) {
      expect(result).not.toHaveProperty(forbidden);
    }
  });

  it("classifies missing, unknown, and unavailable stored facts safely", () => {
    const deal = completeResidential({
      asking_price: null,
      property_condition: "unknown",
    });
    Object.defineProperty(deal, "occupancy_status", {
      get() {
        throw new Error("field failed");
      },
    });
    const result = evaluate(deal);

    expect(result.missingItems.map((entry) => entry.label)).toContain(
      "Asking price"
    );
    expect(result.unknownItems.map((entry) => entry.label)).toContain(
      "Property condition"
    );
    expect(result.unavailableItems.map((entry) => entry.label)).toContain(
      "Occupancy status"
    );
    expect(result.status).toBe("partial");
  });

  it("propagates only supplied conflict, freshness, and verification states", () => {
    const deal = completeResidential();
    const result = evaluate(deal, {
      conflicts: [
        {
          conflictId: "conflict-price",
          summary: "Two asking prices are represented.",
          relatedCanonicalField: "deal.askingPrice",
        },
      ],
      evidenceReferences: [
        {
          evidenceId: "evidence-condition",
          sourceType: "document-record",
          sourceSystem: "Documents",
          sourceRecordId: "document-1",
          sourceField: "property_condition",
          relatedCanonicalField: "property.condition",
          verificationState: "unverified",
        },
        {
          evidenceId: "evidence-timeline",
          sourceType: "crm-current-state",
          sourceSystem: "Deal record",
          sourceRecordId: "deal-1",
          sourceField: "seller_timeline",
          relatedCanonicalField: "seller.timeline",
          freshnessState: "stale",
        },
      ],
    });

    expect(result.conflictingItems[0]).toMatchObject({
      canonicalField: "deal.askingPrice",
      conflictIds: ["conflict-price"],
    });
    expect(result.unverifiedItems[0].canonicalField).toBe(
      "property.condition"
    );
    expect(result.staleItems[0].canonicalField).toBe("seller.timeline");
    expect(result.allItems.filter((entry) => entry.state === "conflicting")).toHaveLength(1);
  });

  it("propagates explicit evidence conflict and preserves verified/current metadata", () => {
    const result = evaluate(completeResidential(), {
      evidenceReferences: [
        {
          evidenceId: "evidence-condition-conflict",
          sourceType: "document-record",
          sourceSystem: "Documents",
          sourceRecordId: "document-1",
          relatedCanonicalField: "property.condition",
          conflictState: "conflicting",
        },
        {
          evidenceId: "evidence-timeline-current",
          sourceType: "crm-current-state",
          sourceSystem: "Deal record",
          sourceRecordId: "deal-1",
          relatedCanonicalField: "seller.timeline",
          verificationState: "verified",
          freshnessState: "current",
        },
      ],
    });
    const condition = result.allItems.find(
      (entry) => entry.canonicalField === "property.condition"
    );
    const timeline = result.allItems.find(
      (entry) => entry.canonicalField === "seller.timeline"
    );

    expect(condition.state).toBe("conflicting");
    expect(condition.conflictIds).toEqual([]);
    expect(timeline).toMatchObject({
      state: "present",
      verificationState: "verified",
      freshnessState: "current",
    });
  });

  it("evaluates supplied unavailable and not-applicable states directly", () => {
    const result = evaluate(completeResidential(), {
      informationStates: {
        "property.condition": "unavailable",
        "property.mortgageStatus": "not-applicable",
      },
    });

    expect(result.unavailableItems.map((entry) => entry.label)).toContain(
      "Property condition"
    );
    expect(result.notApplicableItems.map((entry) => entry.label)).toContain(
      "Mortgage status"
    );
  });

  it("links matching evidence without fabricating a source timestamp", () => {
    const result = evaluate(completeResidential(), {
      evidenceReferences: [
        {
          evidenceId: "evidence-price",
          sourceType: "crm-current-state",
          sourceSystem: "Deal record",
          sourceRecordId: "deal-1",
          sourceField: "asking_price",
          relatedCanonicalField: "deal.askingPrice",
          organizationId: "org-1",
          tenantId: "tenant-1",
        },
      ],
    });
    const price = result.allItems.find(
      (entry) => entry.canonicalField === "deal.askingPrice"
    );

    expect(price.evidenceReferenceIds).toEqual(["evidence-price"]);
    expect(price.sourceTimestamp).toBeNull();
  });

  it("prioritizes classification, contact, and legal land facts deterministically", () => {
    const unknown = evaluate(
      completeResidential({ asset_type: undefined, phone: undefined })
    );
    expect(unknown.openItems[0].requirementId).toBe("asset-classification");
    expect(unknown.highestPriorityAction.actionType).toBe("classify-asset");

    const land = evaluate(
      completeResidential({ asset_type: "vacant-residential-land" })
    );
    expect(land.openItems.find((entry) => entry.requirementId === "land-legal-access")).toBeTruthy();
    expect(land.limitations[0].type).toBe("strategy-not-implemented");
  });

  it("never applies house requirements to vacant land", () => {
    const result = evaluate(
      completeResidential({ asset_type: "vacant-residential-land" })
    );
    const labels = result.allItems.map((entry) => entry.label);

    expect(result.selectedProfile.label).toBe("Vacant Land Safety Preflight");
    expect(labels).toContain("Legal access");
    expect(labels).not.toEqual(
      expect.arrayContaining([
        "Property condition",
        "Repairs needed",
        "ARV / comps status",
      ])
    );
    expect(result.limitations[0].label).toMatch(/not yet implemented/i);
  });

  it.each([
    ["small-multifamily", "strategy-not-implemented"],
    ["manufactured-home", "strategy-deferred"],
    ["commercial", "strategy-deferred"],
  ])("keeps %s on Common Acquisition Core", (assetType, limitation) => {
    const result = evaluate(completeResidential({ asset_type: assetType }));
    expect(result.selectedProfile.label).toBe("Common Acquisition Core");
    expect(result.limitations[0].type).toBe(limitation);
  });

  it("returns editable seller questions and manual research guidance only", () => {
    const residential = evaluate(
      completeResidential({ property_condition: null })
    );
    const land = evaluate(
      completeResidential({ asset_type: "vacant-residential-land" })
    );

    expect(residential.sellerQuestions).toContain(
      "How would you describe the property's current condition?"
    );
    expect(land.researchActions).toContain(
      "Confirm legal access using deed, survey, plat, or title evidence."
    );
    expect(JSON.stringify(land)).not.toMatch(/research completed/i);
  });

  it("creates stable decision issue references while keeping limitations separate", () => {
    const result = evaluate(
      completeResidential({ asset_type: "vacant-residential-land" })
    );
    const issues = toDecisionIssueReferences(result);

    expect(issues[0].issueId).toMatch(/^missing-information:deal-1:/);
    expect(issues.map((entry) => entry.label)).not.toContain(
      "Vacant Land Strategy is not yet implemented."
    );
  });

  it("bounds evaluated items and skips one malformed optional profile", () => {
    const result = evaluate(completeResidential(), {
      requirementProfiles: [
        {},
        {
          profileId: "large-profile",
          label: "Large profile",
          requirements: Array.from(
            { length: MISSING_INFORMATION_LIMITS.ITEMS + 20 },
            (_, index) => ({
              requirementId: `optional-${index}`,
              canonicalField: `optional.${index}`,
              acceptedFieldAliases: [`optional_${index}`],
              label: `Optional ${index}`,
            })
          ),
        },
      ],
    });

    expect(result.allItems.length).toBeLessThanOrEqual(
      MISSING_INFORMATION_LIMITS.ITEMS
    );
    expect(result.partialDataWarnings).toContain(
      "One supplied requirement profile was malformed and was skipped."
    );
  });

  it("uses Common Acquisition Core only for conflicting classification", () => {
    const deal = completeResidential({ property_type: "Vacant land" });
    const result = evaluate(deal);

    expect(result.selectedProfile.label).toBe("Common Acquisition Core");
    expect(result.conflictingItems[0]).toMatchObject({
      requirementId: "asset-classification",
      state: INFORMATION_STATES.CONFLICTING,
    });
    expect(result.highestPriorityAction.actionType).toBe("review-conflict");
  });
});
