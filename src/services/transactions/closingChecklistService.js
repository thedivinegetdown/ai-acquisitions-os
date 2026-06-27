export const CLOSING_CHECKLIST_DEFINITIONS = [
  {
    key: "contractPreparation",
    label: "Contract preparation",
    dependsOn: ["contractStatus"],
  },
  {
    key: "sellerSignature",
    label: "Seller signature",
    dependsOn: ["contractStatus"],
  },
  {
    key: "buyerAssignment",
    label: "Buyer assignment",
    dependsOn: ["buyerAssigned"],
  },
  {
    key: "earnestMoneyDeposit",
    label: "Earnest money deposit",
    dependsOn: ["escrowDeposit"],
  },
  {
    key: "titleOrder",
    label: "Title order",
    dependsOn: ["titleCompany"],
  },
  {
    key: "titleSearch",
    label: "Title search",
    dependsOn: ["titleStatus"],
  },
  {
    key: "lienReview",
    label: "Lien review",
    dependsOn: ["titleStatus"],
  },
  {
    key: "inspectionPeriod",
    label: "Inspection period",
    dependsOn: ["closingDate"],
  },
  {
    key: "closingDocuments",
    label: "Closing documents",
    dependsOn: ["closingDate", "titleCompany"],
  },
  {
    key: "fundingConfirmation",
    label: "Funding confirmation",
    dependsOn: ["buyerAssigned"],
  },
  {
    key: "closingComplete",
    label: "Closing complete",
    dependsOn: ["transactionStatus"],
  },
];

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return value > 0;

  return Boolean(value);
}

function isStatusComplete(field, value) {
  if (!hasValue(value)) return false;

  const normalized = String(value).toLowerCase();

  if (field === "contractStatus") {
    return normalized.includes("signed") || normalized.includes("executed");
  }

  if (field === "titleStatus") {
    return (
      normalized.includes("clear") ||
      normalized.includes("ordered") ||
      normalized.includes("search")
    );
  }

  if (field === "transactionStatus") {
    return normalized.includes("closed");
  }

  return true;
}

function isChecklistItemComplete(item, transaction) {
  return item.dependsOn.every((field) => isStatusComplete(field, transaction[field]));
}

export function buildClosingChecklist(transaction = {}) {
  const checklistItems = CLOSING_CHECKLIST_DEFINITIONS.map((item) => ({
    key: item.key,
    label: item.label,
    complete: isChecklistItemComplete(item, transaction),
  }));
  const completedItems = checklistItems.filter((item) => item.complete);
  const missingItems = checklistItems.filter((item) => !item.complete);
  const closingProgress = checklistItems.length
    ? Math.round((completedItems.length / checklistItems.length) * 100)
    : 0;

  return {
    checklistItems,
    completedItems,
    missingItems,
    closingProgress,
  };
}
