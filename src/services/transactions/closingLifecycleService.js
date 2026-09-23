import { safeTrim } from "../../utils/text";

export const CLOSING_LIFECYCLE_STATUSES = Object.freeze([
  "under_contract",
  "closed",
  "cancelled",
]);

function optionalMoney(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function dateOnly(value) {
  const date = String(value || "").slice(0, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

export function normalizeMaterialDeadlines(deadlines = []) {
  return (Array.isArray(deadlines) ? deadlines : [])
    .map((deadline, index) => ({
      id: safeTrim(deadline?.id) || `deadline-${index + 1}`,
      label: safeTrim(deadline?.label) || "Contract deadline",
      dueDate: dateOnly(deadline?.dueDate ?? deadline?.due_date),
    }))
    .filter((deadline) => deadline.dueDate);
}

export function projectLatestClosingRevision(revisions = []) {
  return [...(Array.isArray(revisions) ? revisions : [])]
    .filter(Boolean)
    .sort((left, right) => {
      const revisionDifference = Number(right.revision_number || 0) - Number(left.revision_number || 0);
      if (revisionDifference) return revisionDifference;
      const timeDifference = new Date(right.created_at || 0) - new Date(left.created_at || 0);
      if (timeDifference) return timeDifference;
      return String(right.id || "").localeCompare(String(left.id || ""));
    })[0] || null;
}

export function buildClosingRevisionPayload({
  acceptedOfferRevision,
  actorReference,
  closing = {},
  deal = {},
  latestRevision,
  status = "under_contract",
} = {}) {
  const normalizedStatus = safeTrim(status).toLowerCase();
  const acceptedOffer = acceptedOfferRevision || latestRevision?.acceptedOfferRevision;
  if (!deal.id) throw new Error("A deal is required to record closing activity.");
  if (acceptedOffer?.status !== "accepted") throw new Error("An accepted offer revision is required.");
  if (!CLOSING_LIFECYCLE_STATUSES.includes(normalizedStatus)) throw new Error("Unknown closing status.");
  if (!latestRevision && normalizedStatus !== "under_contract") {
    throw new Error("The first closing revision must be under contract.");
  }
  if (["closed", "cancelled"].includes(latestRevision?.status)) {
    throw new Error("Closed or cancelled history is terminal.");
  }

  const actualProceeds = optionalMoney(closing.actualRealizedProceeds ?? latestRevision?.actual_realized_proceeds);
  const actualCosts = optionalMoney(closing.actualCosts ?? latestRevision?.actual_costs);
  if (normalizedStatus === "closed" && (actualProceeds == null || actualCosts == null)) {
    throw new Error("Closed deals require realized proceeds and actual costs.");
  }

  return {
    deal_id: deal.id,
    accepted_offer_revision_id: acceptedOffer.id,
    status: normalizedStatus,
    contract_date: dateOnly(closing.contractDate ?? latestRevision?.contract_date),
    closing_date: dateOnly(closing.closingDate ?? latestRevision?.closing_date),
    material_deadlines: normalizeMaterialDeadlines(closing.materialDeadlines ?? latestRevision?.material_deadlines),
    title_company_reference: safeTrim(closing.titleCompanyReference ?? latestRevision?.title_company_reference) || null,
    selected_buyer_id: closing.selectedBuyerId || latestRevision?.selected_buyer_id || null,
    assignment_fee: optionalMoney(closing.assignmentFee ?? latestRevision?.assignment_fee),
    expected_proceeds: optionalMoney(closing.expectedProceeds ?? latestRevision?.expected_proceeds),
    actual_realized_proceeds: actualProceeds,
    actual_costs: actualCosts,
    notes: safeTrim(closing.notes ?? latestRevision?.notes) || null,
    actor_reference: safeTrim(actorReference) || null,
  };
}

export function buildClosingCommitments(revision) {
  if (!revision || revision.status !== "under_contract") return [];
  const deadlines = normalizeMaterialDeadlines(revision.material_deadlines).map((deadline) => ({
    sourceKey: `deadline:${deadline.id}`,
    title: deadline.label,
    dueDate: deadline.dueDate,
  }));
  if (revision.closing_date) {
    deadlines.push({ sourceKey: "closing-date", title: "Closing date", dueDate: revision.closing_date });
  }
  return deadlines;
}
