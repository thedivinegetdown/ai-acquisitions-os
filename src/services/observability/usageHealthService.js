import { getDealAliasText } from "../../utils/dealFields";
import { clampScore } from "../../utils/numbers";

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function analyzeUsageHealth({ deals = [] } = {}) {
  const safeDeals = Array.isArray(deals) ? deals : [];
  const totalDeals = safeDeals.length;
  const missingAddress = safeDeals.filter((deal) =>
    isBlank(getDealAliasText(deal, "address"))
  ).length;
  const missingOwner = safeDeals.filter((deal) =>
    isBlank(getDealAliasText(deal, "ownerName"))
  ).length;
  const missingStage = safeDeals.filter((deal) =>
    isBlank(getDealAliasText(deal, "stage"))
  ).length;
  const dataIssues = missingAddress + missingOwner + missingStage;
  const completenessScore =
    totalDeals === 0
      ? 70
      : clampScore(100 - Math.round((dataIssues / (totalDeals * 3)) * 100));
  const warnings = [];

  if (totalDeals === 0) {
    warnings.push("No deals are loaded, so operational health is based on configuration only.");
  }

  if (missingAddress > 0) warnings.push(`${missingAddress} deals are missing addresses.`);
  if (missingOwner > 0) warnings.push(`${missingOwner} deals are missing owners.`);
  if (missingStage > 0) warnings.push(`${missingStage} deals are missing stages.`);

  return {
    totalDeals,
    missingAddress,
    missingOwner,
    missingStage,
    completenessScore,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
