export const COMMAND_ACTIONS = {
  "open-seller-workspace": {
    label: "Open seller workspace",
    description: "Open the deal modal for this seller.",
  },
  "open-deal": {
    label: "Open deal",
    description: "Open the deal record.",
  },
  "open-conversation": {
    label: "Open conversation",
    description: "Review the seller communication timeline.",
  },
  "view-ai-recommendation": {
    label: "View AI recommendation",
    description: "Review intelligence and next best action.",
  },
  "view-next-best-action": {
    label: "View next best action",
    description: "Review recommended task or follow-up.",
  },
  "view-transaction-checklist": {
    label: "View transaction checklist",
    description: "Review transaction and closing readiness.",
  },
  "view-buyer-matches": {
    label: "View buyer matches",
    description: "Review buyer/dispositions foundation.",
  },
  "view-documents": {
    label: "View documents",
    description: "Review document and contract prep foundation.",
  },
  "view-campaign-performance": {
    label: "View campaign performance",
    description: "Review manual campaign attribution metrics.",
  },
  "view-workflow-items": {
    label: "View workflow items",
    description: "Review workflow recommendations and approvals.",
  },
};

export function getCommandAction(actionId = "") {
  return (
    COMMAND_ACTIONS[actionId] || {
      label: "View details",
      description: "Review the selected record.",
    }
  );
}

export function buildSuggestedActions(results = []) {
  const uniqueActions = [...new Set(results.map((result) => result.action).filter(Boolean))];

  return uniqueActions.slice(0, 8).map((actionId) => ({
    id: actionId,
    ...getCommandAction(actionId),
  }));
}
