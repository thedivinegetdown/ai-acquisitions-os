import { getDealAliasText } from "../../utils/dealFields";
import { parseSafeNumber } from "../../utils/numbers";
import { safeTrim } from "../../utils/text";
import { buildClosingChecklist } from "./closingChecklistService";
import {
  analyzeTransactionRisks,
  getTransactionConfidence,
} from "./transactionRiskService";

export const TRANSACTION_STATUSES = [
  "Pre-contract",
  "Contract sent",
  "Under contract",
  "In title",
  "Clear to close",
  "Closed",
  "On hold",
];

export const CONTRACT_STATUSES = [
  "Not started",
  "Drafting",
  "Sent for review",
  "Signed",
  "Executed",
];

export const TITLE_STATUSES = [
  "Not ordered",
  "Ordered",
  "Search in progress",
  "Issues found",
  "Clear",
];

export const EXIT_STRATEGIES = [
  "Unclear",
  "Wholesale",
  "Assignment",
  "Double close",
  "Fix and flip",
  "Buy and hold",
  "Seller finance",
  "Subject-to",
];

export function buildInitialTransactionState(deal) {
  return {
    transactionStatus:
      getDealAliasText(deal, "stage") === "Under Contract"
        ? "Under contract"
        : "Pre-contract",
    contractStatus: "Not started",
    titleStatus: "Not ordered",
    closingDate: deal?.closing_date || "",
    escrowDeposit: "",
    titleCompany: "",
    closingAttorney: "",
    buyerAssigned: "",
    assignmentFee: deal?.assignment_fee || "",
    exitStrategy: "Unclear",
    notes: "",
  };
}

export function normalizeTransactionState(transaction = {}) {
  return {
    transactionStatus: safeTrim(transaction.transactionStatus) || "Pre-contract",
    contractStatus: safeTrim(transaction.contractStatus) || "Not started",
    titleStatus: safeTrim(transaction.titleStatus) || "Not ordered",
    closingDate: safeTrim(transaction.closingDate),
    escrowDeposit: parseSafeNumber(transaction.escrowDeposit),
    titleCompany: safeTrim(transaction.titleCompany),
    closingAttorney: safeTrim(transaction.closingAttorney),
    buyerAssigned: safeTrim(transaction.buyerAssigned),
    assignmentFee: parseSafeNumber(transaction.assignmentFee),
    exitStrategy: safeTrim(transaction.exitStrategy) || "Unclear",
    notes: safeTrim(transaction.notes),
  };
}

function getRecommendedNextAction({ checklist, riskAnalysis, transaction }) {
  if (riskAnalysis.missingItems.includes("Contract status")) {
    return "Prepare internal contract details before any legal document workflow.";
  }

  if (riskAnalysis.missingItems.includes("Title company")) {
    return "Select or confirm the title company.";
  }

  if (riskAnalysis.missingItems.includes("Closing date")) {
    return "Set a target closing date.";
  }

  if (riskAnalysis.missingItems.includes("Buyer assigned")) {
    return "Assign or shortlist the buyer before disposition execution.";
  }

  if (checklist.closingProgress >= 80) {
    return "Review final closing readiness and funding confirmation.";
  }

  if (transaction.titleStatus === "Issues found") {
    return "Review title and lien issues before advancing closing.";
  }

  return "Continue completing the closing checklist.";
}

export function analyzeTransaction(transactionInput = {}) {
  const transaction = normalizeTransactionState(transactionInput);
  const checklist = buildClosingChecklist(transaction);
  const riskAnalysis = analyzeTransactionRisks(transaction, checklist);
  const confidence = getTransactionConfidence({
    closingProgress: checklist.closingProgress,
    risks: riskAnalysis.risks,
  });
  const recommendedNextAction = getRecommendedNextAction({
    checklist,
    riskAnalysis,
    transaction,
  });

  return {
    transactionStatus: transaction.transactionStatus,
    closingProgress: checklist.closingProgress,
    checklistItems: checklist.checklistItems,
    completedItems: checklist.completedItems,
    missingItems: [
      ...new Set([
        ...checklist.missingItems.map((item) => item.label),
        ...riskAnalysis.missingItems,
      ]),
    ],
    risks: riskAnalysis.risks,
    recommendedNextAction,
    confidence,
    summary:
      checklist.closingProgress >= 80
        ? "Transaction tracking indicates this deal is approaching closing readiness."
        : "Transaction tracking is preliminary. Complete contract, title, buyer, funding, and closing details before execution.",
    generatedAt: new Date().toISOString(),
  };
}
