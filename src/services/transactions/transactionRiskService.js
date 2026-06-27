import { parseSafeNumber } from "../../utils/numbers";
import { normalizeText, uniqueStrings } from "../../utils/text";

export function analyzeTransactionRisks(transaction = {}, checklist = {}) {
  const risks = [];
  const missingItems = [];
  const contractStatus = normalizeText(transaction.contractStatus);
  const titleStatus = normalizeText(transaction.titleStatus);
  const exitStrategy = normalizeText(transaction.exitStrategy);
  const escrowDeposit = parseSafeNumber(transaction.escrowDeposit);
  const assignmentFee = parseSafeNumber(transaction.assignmentFee);

  if (!contractStatus || contractStatus.includes("not started")) {
    risks.push("Missing contract");
    missingItems.push("Contract status");
  }

  if (!transaction.titleCompany) {
    risks.push("Missing title company");
    missingItems.push("Title company");
  }

  if (!transaction.closingDate) {
    risks.push("No closing date");
    missingItems.push("Closing date");
  }

  if (!transaction.buyerAssigned) {
    risks.push("No buyer assigned");
    missingItems.push("Buyer assigned");
  }

  if (!exitStrategy || exitStrategy.includes("unclear")) {
    risks.push("Unclear exit strategy");
    missingItems.push("Exit strategy");
  }

  if (
    titleStatus.includes("issue") ||
    titleStatus.includes("lien") ||
    titleStatus.includes("unknown") ||
    !titleStatus
  ) {
    risks.push("Title/lien risk");
  }

  if (!escrowDeposit || escrowDeposit <= 0) {
    risks.push("Funding risk");
    missingItems.push("Escrow deposit");
  }

  if (exitStrategy.includes("wholesale") && (!assignmentFee || assignmentFee <= 0)) {
    missingItems.push("Assignment fee");
  }

  if ((checklist.closingProgress || 0) < 40) {
    risks.push("Closing workflow is still early.");
  }

  return {
    risks: uniqueStrings(risks),
    missingItems: uniqueStrings(missingItems),
  };
}

export function getTransactionConfidence({ closingProgress = 0, risks = [] } = {}) {
  if (closingProgress >= 80 && risks.length <= 2) return "High";
  if (closingProgress >= 45 && risks.length <= 4) return "Medium";

  return "Low";
}
