import { safeTrim } from "../../utils/text";

export const OFFER_LIFECYCLE_STATUSES = Object.freeze([
  "draft",
  "sent",
  "countered",
  "accepted",
  "rejected",
  "withdrawn",
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  draft: ["draft", "sent", "withdrawn"],
  sent: ["countered", "accepted", "rejected", "withdrawn"],
  countered: ["sent", "accepted", "rejected", "withdrawn"],
  rejected: ["draft"],
  withdrawn: ["draft"],
  accepted: [],
});

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

export function projectLatestOfferRevision(revisions = []) {
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

export function canTransitionOffer(previousStatus, nextStatus) {
  if (!previousStatus) return nextStatus === "draft";
  return (ALLOWED_TRANSITIONS[previousStatus] || []).includes(nextStatus);
}

export function buildOfferDecisionBasis(deal = {}) {
  return {
    contractVersion: "decision-contract-v1",
    rulesetVersion: "decision-compatibility-v1",
    researchRevision: Number(deal.research_revision || 0),
    dealUpdatedAt: deal.updated_at || null,
    assetType: deal.asset_type || deal.property_type || null,
    offerReady: deal.offer_ready === true,
    underwriting: {
      askingPrice: optionalMoney(deal.asking_price ?? deal.price),
      afterRepairValue: optionalMoney(deal.arv),
      repairs: optionalMoney(deal.repairs),
    },
  };
}

export function buildOfferRevisionPayload({
  actorReference,
  deal = {},
  latestRevision,
  revision = {},
  status = "draft",
} = {}) {
  const normalizedStatus = safeTrim(status).toLowerCase();
  const amount = optionalMoney(revision.offerAmount ?? revision.offer_amount ?? latestRevision?.offer_amount);
  if (!deal.id) throw new Error("A deal is required to record an offer revision.");
  if (!OFFER_LIFECYCLE_STATUSES.includes(normalizedStatus)) throw new Error("Unknown offer status.");
  if (!canTransitionOffer(latestRevision?.status, normalizedStatus)) {
    throw new Error(`Invalid offer transition from ${latestRevision?.status || "empty history"} to ${normalizedStatus}.`);
  }
  if (amount == null) throw new Error("Offer amount must be a non-negative number.");

  const countered = normalizedStatus === "countered";
  return {
    deal_id: deal.id,
    revision_kind: countered ? "seller_counter" : "offer",
    status: normalizedStatus,
    offer_amount: amount,
    terms: {
      offerType: safeTrim(revision.offerType ?? revision.offer_type ?? latestRevision?.terms?.offerType) || "cash",
      downPayment: optionalMoney(revision.downPayment ?? latestRevision?.terms?.downPayment),
      monthlyPayment: optionalMoney(revision.monthlyPayment ?? latestRevision?.terms?.monthlyPayment),
      interestRate: optionalMoney(revision.interestRate ?? latestRevision?.terms?.interestRate),
      termMonths: optionalMoney(revision.termMonths ?? latestRevision?.terms?.termMonths),
      closingTimeline: safeTrim(revision.closingTimeline ?? latestRevision?.terms?.closingTimeline) || null,
    },
    decision_basis: latestRevision?.decision_basis || buildOfferDecisionBasis(deal),
    follow_up_date: dateOnly(revision.followUpDate ?? revision.follow_up_date ?? latestRevision?.follow_up_date),
    notes: safeTrim(revision.notes ?? latestRevision?.notes) || null,
    actor_reference: safeTrim(actorReference) || null,
  };
}

export function buildOfferCommitments(revision) {
  if (!revision?.follow_up_date || !["sent", "countered"].includes(revision.status)) return [];
  return [{
    sourceKey: "offer-follow-up",
    title: revision.status === "countered" ? "Respond to seller counter" : "Follow up on sent offer",
    dueDate: revision.follow_up_date,
  }];
}
