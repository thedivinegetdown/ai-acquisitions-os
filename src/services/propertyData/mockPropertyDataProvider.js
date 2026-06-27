import { createSuccess } from "../api";
import {
  buildPropertyDataInput,
  normalizePropertyDataResult,
} from "./propertyDataNormalizer";

function buildMockComps(address) {
  if (!address) return [];

  return [
    {
      address: `${address} Comp 1`,
      soldPrice: 245000,
      soldDate: "2026-01-15",
      beds: 3,
      baths: 2,
      squareFeet: 1450,
      distanceMiles: 0.4,
      similarityScore: 82,
      source: "mock",
    },
    {
      address: `${address} Comp 2`,
      soldPrice: 262000,
      soldDate: "2026-02-22",
      beds: 3,
      baths: 2,
      squareFeet: 1525,
      distanceMiles: 0.7,
      similarityScore: 78,
      source: "mock",
    },
  ];
}

export const mockPropertyDataProvider = {
  id: "mock",
  label: "Mock property data",
  async lookupPropertyData(input = {}) {
    const normalizedInput = buildPropertyDataInput(input);
    const address = normalizedInput.address;

    return createSuccess(
      normalizePropertyDataResult({
        address,
        deal: normalizedInput.deal,
        owner: address
          ? {
              ownerName: "Mock Owner",
              mailingAddress: address,
              ownershipLengthYears: 7,
              absenteeOwner: false,
              source: "mock",
            }
          : null,
        tax: address
          ? {
              assessedValue: 210000,
              annualTaxes: 3200,
              taxYear: 2025,
              delinquentTaxes: false,
              source: "mock",
            }
          : null,
        valuation: address
          ? {
              estimatedValue: 255000,
              lowValue: 235000,
              highValue: 275000,
              arvEstimate: 285000,
              rentEstimate: 1850,
              confidence: "Medium",
              source: "mock",
            }
          : null,
        comps: buildMockComps(address),
        confidence: address ? "Medium" : "Low",
        source: "mock",
      })
    );
  },
};
