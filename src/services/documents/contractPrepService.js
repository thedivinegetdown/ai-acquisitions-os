import { getDealAliasPositiveNumber, getDealAliasText } from "../../utils/dealFields";
import { safeTrim } from "../../utils/text";

export const DOCUMENT_STATUSES = [
  "Not started",
  "Needed",
  "Requested",
  "Received",
  "In review",
  "Complete",
  "Not applicable",
];

export function buildInitialDocumentState(deal = null) {
  return {
    purchaseAgreementStatus: "Not started",
    assignmentAgreementStatus: "Not started",
    sellerDisclosuresStatus: "Needed",
    titleDocumentsStatus: "Needed",
    proofOfFundsStatus: "Needed",
    inspectionDocumentsStatus: "Not started",
    closingPackageStatus: "Not started",
    sellerLegalName: getDealAliasText(deal, "ownerName"),
    propertyAddress: getDealAliasText(deal, "address"),
    purchasePrice:
      getDealAliasPositiveNumber(deal, "askingPrice") ||
      getDealAliasPositiveNumber(deal, "arv") ||
      "",
    closingDate: deal?.closing_date || deal?.target_closing_date || "",
    titleCompany: deal?.title_company || "",
    earnestMoneyDeposit: deal?.earnest_money_deposit || "",
    contingencies: deal?.contingencies || "",
    buyerAssignee: deal?.buyer_assignee || deal?.buyerAssigned || "",
    exitStrategy: deal?.exit_strategy || deal?.exitStrategy || "",
    notes: "",
  };
}

export function normalizeDocumentState(documents = {}) {
  return {
    purchaseAgreementStatus:
      safeTrim(documents.purchaseAgreementStatus) || "Not started",
    assignmentAgreementStatus:
      safeTrim(documents.assignmentAgreementStatus) || "Not started",
    sellerDisclosuresStatus:
      safeTrim(documents.sellerDisclosuresStatus) || "Needed",
    titleDocumentsStatus: safeTrim(documents.titleDocumentsStatus) || "Needed",
    proofOfFundsStatus: safeTrim(documents.proofOfFundsStatus) || "Needed",
    inspectionDocumentsStatus:
      safeTrim(documents.inspectionDocumentsStatus) || "Not started",
    closingPackageStatus: safeTrim(documents.closingPackageStatus) || "Not started",
    sellerLegalName: safeTrim(documents.sellerLegalName),
    propertyAddress: safeTrim(documents.propertyAddress),
    purchasePrice: documents.purchasePrice || "",
    closingDate: safeTrim(documents.closingDate),
    titleCompany: safeTrim(documents.titleCompany),
    earnestMoneyDeposit: documents.earnestMoneyDeposit || "",
    contingencies: safeTrim(documents.contingencies),
    buyerAssignee: safeTrim(documents.buyerAssignee),
    exitStrategy: safeTrim(documents.exitStrategy),
    notes: safeTrim(documents.notes),
  };
}

function isComplete(value) {
  return Boolean(safeTrim(value));
}

function isDocumentComplete(status) {
  return ["Received", "In review", "Complete", "Not applicable"].includes(status);
}

export function buildContractPrepChecklist(documentInput = {}) {
  const documents = normalizeDocumentState(documentInput);
  const checklistItems = [
    {
      key: "sellerLegalName",
      label: "Confirm seller legal name",
      complete: isComplete(documents.sellerLegalName),
    },
    {
      key: "propertyAddress",
      label: "Confirm property address",
      complete: isComplete(documents.propertyAddress),
    },
    {
      key: "purchasePrice",
      label: "Confirm purchase price",
      complete: Boolean(documents.purchasePrice),
    },
    {
      key: "closingDate",
      label: "Confirm closing date",
      complete: isComplete(documents.closingDate),
    },
    {
      key: "titleCompany",
      label: "Confirm title company",
      complete: isComplete(documents.titleCompany),
    },
    {
      key: "earnestMoneyDeposit",
      label: "Confirm earnest money deposit",
      complete: Boolean(documents.earnestMoneyDeposit),
    },
    {
      key: "contingencies",
      label: "Confirm contingencies",
      complete: isComplete(documents.contingencies),
    },
    {
      key: "buyerAssignee",
      label: "Confirm buyer/assignee if applicable",
      complete:
        isComplete(documents.buyerAssignee) ||
        documents.assignmentAgreementStatus === "Not applicable",
    },
    {
      key: "exitStrategy",
      label: "Confirm exit strategy",
      complete: isComplete(documents.exitStrategy),
    },
    {
      key: "internalReview",
      label: "Internal review complete",
      complete:
        isDocumentComplete(documents.purchaseAgreementStatus) &&
        isDocumentComplete(documents.titleDocumentsStatus),
    },
  ];

  const completedItems = checklistItems.filter((item) => item.complete);
  const missingItems = checklistItems.filter((item) => !item.complete);

  return {
    checklistItems,
    completedItems,
    missingItems,
    progress: Math.round((completedItems.length / checklistItems.length) * 100),
  };
}

export function getContractPrepStatus(progress) {
  if (progress >= 90) return "Ready for internal review";
  if (progress >= 60) return "In preparation";
  if (progress > 0) return "Needs more details";
  return "Not started";
}
