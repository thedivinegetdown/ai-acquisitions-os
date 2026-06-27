import { safeTrim } from "../../utils/text";

function missing(label, condition) {
  return condition ? label : null;
}

export function analyzeDocumentRisks(documents = {}, checklist = {}) {
  const missingItems = [
    missing("Seller legal name", !safeTrim(documents.sellerLegalName)),
    missing("Purchase price", !documents.purchasePrice),
    missing("Closing date", !safeTrim(documents.closingDate)),
    missing("Title company", !safeTrim(documents.titleCompany)),
    missing("Exit strategy", !safeTrim(documents.exitStrategy)),
    missing(
      "Buyer assignment details",
      documents.assignmentAgreementStatus !== "Not applicable" &&
        !safeTrim(documents.buyerAssignee)
    ),
    missing(
      "Required documents",
      [
        documents.purchaseAgreementStatus,
        documents.sellerDisclosuresStatus,
        documents.titleDocumentsStatus,
        documents.proofOfFundsStatus,
      ].some((status) => ["Not started", "Needed"].includes(status))
    ),
  ].filter(Boolean);

  const risks = [
    missingItems.includes("Seller legal name")
      ? "Seller legal name must be confirmed before contract preparation."
      : null,
    missingItems.includes("Purchase price")
      ? "Purchase price is missing and contract terms are not ready."
      : null,
    missingItems.includes("Closing date")
      ? "Closing date is missing and timeline expectations are unclear."
      : null,
    missingItems.includes("Title company")
      ? "Title company is not confirmed."
      : null,
    missingItems.includes("Buyer assignment details")
      ? "Buyer/assignee details are missing for assignment preparation."
      : null,
    checklist.progress < 60
      ? "Contract preparation is preliminary and needs internal review."
      : null,
  ].filter(Boolean);

  return {
    missingItems,
    risks,
  };
}

export function getDocumentConfidence({ score = 0, risks = [] } = {}) {
  if (score >= 85 && risks.length <= 1) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}
