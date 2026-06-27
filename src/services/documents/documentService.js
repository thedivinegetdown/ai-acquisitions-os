import {
  buildContractPrepChecklist,
  getContractPrepStatus,
  normalizeDocumentState,
} from "./contractPrepService";
import {
  analyzeDocumentRisks,
  getDocumentConfidence,
} from "./documentRiskService";

function getRecommendedNextAction({ documents, checklist, riskAnalysis }) {
  if (riskAnalysis.missingItems.includes("Seller legal name")) {
    return "Confirm the seller legal name before preparing any contract package.";
  }

  if (riskAnalysis.missingItems.includes("Purchase price")) {
    return "Confirm the purchase price and internal offer terms.";
  }

  if (riskAnalysis.missingItems.includes("Closing date")) {
    return "Set or confirm the target closing date.";
  }

  if (riskAnalysis.missingItems.includes("Title company")) {
    return "Confirm the title company before advancing contract prep.";
  }

  if (riskAnalysis.missingItems.includes("Required documents")) {
    return "Request or upload required supporting documents for internal review.";
  }

  if (documents.purchaseAgreementStatus !== "Complete") {
    return "Move the purchase agreement into internal review.";
  }

  if (checklist.progress >= 90) {
    return "Complete final internal review before involving legal counsel or e-sign workflows.";
  }

  return "Continue completing the contract preparation checklist.";
}

export function analyzeDocumentReadiness(documentInput = {}) {
  const documents = normalizeDocumentState(documentInput);
  const checklist = buildContractPrepChecklist(documents);
  const riskAnalysis = analyzeDocumentRisks(documents, checklist);
  const documentReadinessScore = Math.max(
    0,
    Math.min(100, checklist.progress - riskAnalysis.risks.length * 5)
  );
  const contractPrepStatus = getContractPrepStatus(documentReadinessScore);
  const confidence = getDocumentConfidence({
    score: documentReadinessScore,
    risks: riskAnalysis.risks,
  });

  return {
    documentReadinessScore,
    contractPrepStatus,
    checklistItems: checklist.checklistItems,
    completedItems: checklist.completedItems,
    missingItems: [
      ...new Set([
        ...checklist.missingItems.map((item) => item.label),
        ...riskAnalysis.missingItems,
      ]),
    ],
    risks: riskAnalysis.risks,
    recommendedNextAction: getRecommendedNextAction({
      documents,
      checklist,
      riskAnalysis,
    }),
    confidence,
    summary:
      documentReadinessScore >= 80
        ? "Document preparation is approaching internal review readiness. No legal documents are generated automatically."
        : "Document preparation is still preliminary. Confirm contract terms, title details, assignment details, and required documents before legal review.",
    generatedAt: new Date().toISOString(),
  };
}
