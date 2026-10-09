// Deal intent is independent of lifecycle, factual completeness, and readiness.
export const OPERATING_SCOPES = Object.freeze({
  ACTIVE_ACQUISITION: "active_acquisition",
  RESEARCH_ONLY: "research_only",
});

export const ACTION_AUTHORIZATION = Object.freeze({
  RESEARCH_REVIEW: "research-review",
  ACQUISITION: "acquisition",
  UNCLASSIFIED: "unclassified",
});

export const RESEARCH_ONLY_NOTICE = "Research and evidence remain available. Seller outreach, paid diligence, bidding, offers, purchase, and closing actions are not authorized.";

export function getOperatingScopePolicy(deal = {}) {
  let value;
  try { value = deal.operating_scope; } catch { value = "unreadable"; }
  // Only absent legacy values inherit acquisition behavior; invalid values fail closed.
  const scope = value == null ? OPERATING_SCOPES.ACTIVE_ACQUISITION : value;
  const supported = Object.values(OPERATING_SCOPES).includes(scope);
  return {
    scope: supported ? scope : null,
    supported,
    restricted: scope !== OPERATING_SCOPES.ACTIVE_ACQUISITION,
    explanation: !supported ? "The operating scope is unsupported. Review it before taking action."
      : scope === OPERATING_SCOPES.RESEARCH_ONLY ? RESEARCH_ONLY_NOTICE
        : "Existing acquisition workflows and approval requirements apply. Operating scope does not authorize an individual action.",
  };
}

export function isOperatingActionEligible(deal, authorizationCategory) {
  const policy = getOperatingScopePolicy(deal);
  return policy.supported && (!policy.restricted || authorizationCategory === ACTION_AUTHORIZATION.RESEARCH_REVIEW);
}

// Free-text obligations have no authorization metadata. Preserve them as records,
// but recommend review rather than execution when the scope restricts acquisition.
export function researchCommitmentReview({ overdue = false, due = false } = {}) {
  return overdue
    ? "Review the overdue commitment within research-only scope."
    : due
      ? "Review the due commitment within research-only scope."
      : "Continue research-only review of this opportunity.";
}
