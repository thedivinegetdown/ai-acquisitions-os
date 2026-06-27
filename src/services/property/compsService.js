import {
  getDealAliasPositiveNumber,
  getDealAliasText,
} from "../../utils/dealFields";
import { parseSafeNumber } from "../../utils/numbers";
import { safeTrim } from "../../utils/text";

export function buildInitialPropertyInputs(deal) {
  return {
    estimatedArv: getDealAliasPositiveNumber(deal, "arv") ?? "",
    estimatedRepairs: getDealAliasPositiveNumber(deal, "repairs") ?? "",
    estimatedRent: getDealAliasPositiveNumber(deal, "rent") ?? "",
    propertyCondition: getDealAliasText(deal, "condition") || "Unknown",
    occupancyStatus: getDealAliasText(deal, "occupancy") || "Unknown",
    neighborhoodQuality: "Unknown",
    exitStrategy: "Review manually",
    notes: "",
  };
}

export function normalizePropertyInputs(inputs = {}) {
  return {
    estimatedArv: parseSafeNumber(inputs.estimatedArv),
    estimatedRepairs: parseSafeNumber(inputs.estimatedRepairs),
    estimatedRent: parseSafeNumber(inputs.estimatedRent),
    propertyCondition: safeTrim(inputs.propertyCondition) || "Unknown",
    occupancyStatus: safeTrim(inputs.occupancyStatus) || "Unknown",
    neighborhoodQuality: safeTrim(inputs.neighborhoodQuality) || "Unknown",
    exitStrategy: safeTrim(inputs.exitStrategy) || "Review manually",
    notes: safeTrim(inputs.notes),
  };
}

export function analyzeCompsConfidence({ estimatedArv, estimatedRepairs } = {}) {
  if (estimatedArv && estimatedRepairs !== null && estimatedRepairs !== undefined) {
    return "High";
  }

  if (estimatedArv) {
    return "Medium";
  }

  return "Low";
}
