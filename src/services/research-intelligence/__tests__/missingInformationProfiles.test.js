import { describe, expect, it } from "vitest";
import { buildAssetStrategyContext } from "../../asset-strategy";
import { OFFER_READINESS_CHECKLIST } from "../../offers/offerReadinessService";
import {
  COMMON_ACQUISITION_CORE_PROFILE,
  RESIDENTIAL_COMPATIBILITY_PROFILE,
  RESIDENTIAL_STRATEGY_REQUIREMENTS_PROFILE,
  VACANT_LAND_PREFLIGHT_PROFILE,
  selectMissingInformationProfiles,
} from "../index";

function selection(assetType, propertyType) {
  return selectMissingInformationProfiles(
    buildAssetStrategyContext({
      id: "deal-1",
      asset_type: assetType,
      property_type: propertyType,
    })
  );
}

describe("Missing Information profiles", () => {
  it("keeps universal requirements limited to the Common Acquisition Core", () => {
    expect(COMMON_ACQUISITION_CORE_PROFILE.label).toBe(
      "Common Acquisition Core"
    );
    expect(
      COMMON_ACQUISITION_CORE_PROFILE.requirements.map(
        (entry) => entry.requirementId
      )
    ).toEqual(
      expect.arrayContaining([
        "opportunity-identity",
        "property-or-parcel-identity",
        "seller-identity",
        "asset-classification",
        "seller-contact-method",
        "pipeline-stage",
        "seller-target-price",
        "seller-motivation",
        "seller-timeline",
      ])
    );
    expect(
      COMMON_ACQUISITION_CORE_PROFILE.requirements.some((entry) =>
        /repairs|arv/i.test(entry.label)
      )
    ).toBe(false);
  });

  it("adapts every existing residential readiness alias", () => {
    expect(RESIDENTIAL_COMPATIBILITY_PROFILE.label).toBe(
      "Residential Compatibility Requirements"
    );
    expect(RESIDENTIAL_COMPATIBILITY_PROFILE.compatibilityOnly).toBe(true);
    expect(
      RESIDENTIAL_COMPATIBILITY_PROFILE.requirements.map((entry) => ({
        keys: entry.acceptedFieldAliases,
        label: entry.label,
      }))
    ).toEqual(OFFER_READINESS_CHECKLIST);
  });

  it("defines the bounded Vacant Land Safety Preflight criticalities", () => {
    const blockingLabels = VACANT_LAND_PREFLIGHT_PROFILE.requirements
      .filter((entry) => entry.criticality === "blocking")
      .map((entry) => entry.label);
    const advisoryLabels = VACANT_LAND_PREFLIGHT_PROFILE.requirements
      .filter((entry) => entry.criticality === "advisory")
      .map((entry) => entry.label);

    expect(VACANT_LAND_PREFLIGHT_PROFILE.profileId).toBe(
      "vacant-land-preflight-compatibility-v1"
    );
    expect(blockingLabels).toEqual([
      "Parcel identity",
      "Legal access",
      "Zoning",
      "Permitted use",
      "Flood-zone status",
      "Wetlands status",
      "Taxes and liens",
    ]);
    expect(advisoryLabels).toEqual(
      expect.arrayContaining([
        "Road frontage",
        "Utilities",
        "Water, sewer, or septic feasibility",
        "Topography",
        "Deed restrictions",
        "Subdivision potential",
        "Comparable land sales",
        "Builder demand",
      ])
    );
  });

  it("selects no residential profile for unknown or conflicting assets", () => {
    const unknown = selection(undefined);
    const conflict = selection("residential-home", "Vacant land");

    expect(unknown.profiles.map((entry) => entry.label)).toEqual([
      "Common Acquisition Core",
    ]);
    expect(conflict.profiles.map((entry) => entry.label)).toEqual([
      "Common Acquisition Core",
    ]);
    expect(unknown.limitations[0].type).toBe("capability-blocked");
    expect(conflict.limitations[0].type).toBe("capability-blocked");
  });

  it("selects the implemented residential profile and land preflight independently", () => {
    expect(
      selection("residential-home").profiles.map((entry) => entry.label)
    ).toEqual([
      "Common Acquisition Core",
      "Residential Strategy Requirements",
    ]);
    expect(selection("residential-home").activeProfile.profileId).toBe(
      "residential-strategy-requirements-v1"
    );
    expect(RESIDENTIAL_STRATEGY_REQUIREMENTS_PROFILE.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementId: "residential-strategy-asking-price", criticality: "blocking" }),
        expect.objectContaining({ requirementId: "residential-strategy-after-repair-value", criticality: "blocking" }),
        expect.objectContaining({ requirementId: "residential-strategy-mortgage-status", criticality: "advisory" }),
      ])
    );
    const land = selection("vacant-residential-land");
    expect(land.profiles.map((entry) => entry.label)).toEqual([
      "Common Acquisition Core",
      "Vacant Land Safety Preflight",
    ]);
    expect(land.limitations[0].type).toBe("strategy-not-implemented");
  });

  it.each([
    ["small-multifamily", "strategy-not-implemented"],
    ["manufactured-home", "strategy-deferred"],
    ["commercial", "strategy-deferred"],
  ])("uses core-only behavior for %s", (assetType, limitationType) => {
    const result = selection(assetType);
    expect(result.profiles.map((entry) => entry.label)).toEqual([
      "Common Acquisition Core",
    ]);
    expect(result.limitations[0].type).toBe(limitationType);
  });
});
