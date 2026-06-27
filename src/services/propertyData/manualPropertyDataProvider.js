import { createSuccess } from "../api";
import {
  buildPropertyDataInput,
  normalizePropertyDataResult,
} from "./propertyDataNormalizer";

export const manualPropertyDataProvider = {
  id: "manual",
  label: "Manual property data",
  async lookupPropertyData(input = {}) {
    const normalizedInput = buildPropertyDataInput(input);
    const manualData = normalizedInput.manualData || {};

    return createSuccess(
      normalizePropertyDataResult({
        address: normalizedInput.address,
        deal: normalizedInput.deal,
        owner: manualData.owner || null,
        tax: manualData.tax || null,
        valuation: manualData.valuation || null,
        comps: manualData.comps || [],
        confidence: manualData.confidence || "Low",
        source: "manual",
        missingData: manualData.missingData || [],
      })
    );
  },
};
