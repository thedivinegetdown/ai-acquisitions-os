import { getDealAliasPositiveNumber, getDealAliasText } from "../../utils/dealFields";
import { formatSafeDate } from "../../utils/dates";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getDealId(deal = {}, fallback = "") {
  return deal.id || deal.deal_id || deal.lead_id || fallback;
}

function getAddress(deal = {}) {
  return getDealAliasText(deal, "address") || "Unknown property";
}

function getSeller(deal = {}) {
  return getDealAliasText(deal, "ownerName") || "Unknown seller";
}

function buildNotification({
  id,
  title,
  category,
  priority = "Medium",
  deal = null,
  reason,
  recommendedAction,
  status = "New",
  action = "open-seller-workspace",
  requiresApproval = false,
} = {}) {
  return {
    id,
    title,
    category,
    priority,
    relatedSeller: deal ? getSeller(deal) : "",
    relatedDeal: deal ? getAddress(deal) : "",
    dealId: deal ? getDealId(deal) : null,
    deal,
    reason,
    recommendedAction,
    createdAt: new Date().toISOString(),
    status,
    action,
    requiresApproval,
  };
}

export function buildDealNotifications(deals = []) {
  const date = todayIso();
  const safeDeals = Array.isArray(deals) ? deals : [];
  const notifications = [];

  safeDeals.forEach((deal, index) => {
    const id = getDealId(deal, index);
    const dueDate = deal.due_date || deal.follow_up_date;
    const stage = getDealAliasText(deal, "stage");
    const leadScore = getDealAliasPositiveNumber(deal, "leadScore") || 0;
    const motivation = getDealAliasPositiveNumber(deal, "motivation") || 0;
    const address = getAddress(deal);

    if (dueDate === date) {
      notifications.push(
        buildNotification({
          id: `${id}-follow-up-due`,
          title: `Follow-up due: ${address}`,
          category: "Follow-ups due",
          priority: "High",
          deal,
          reason: `Follow-up is due ${formatSafeDate(dueDate, "today")}.`,
          recommendedAction: "Open seller workspace and review next contact step.",
          action: "open-conversation",
        })
      );
    }

    if (dueDate && dueDate < date) {
      notifications.push(
        buildNotification({
          id: `${id}-overdue-task`,
          title: `Overdue task: ${address}`,
          category: "Overdue tasks",
          priority: "Critical",
          deal,
          reason: `Follow-up was due ${formatSafeDate(dueDate, "earlier")}.`,
          recommendedAction: "Open seller workspace and update the follow-up plan.",
          action: "open-seller-workspace",
        })
      );
    }

    if (leadScore >= 8 && motivation >= 8) {
      notifications.push(
        buildNotification({
          id: `${id}-critical-lead`,
          title: `Critical lead: ${address}`,
          category: "Critical leads",
          priority: "Critical",
          deal,
          reason: "Lead score and motivation are both high.",
          recommendedAction: "Review AI recommendation and decide next seller contact.",
          action: "view-ai-recommendation",
        })
      );
    }

    if (!getDealAliasText(deal, "phone") && !deal.email) {
      notifications.push(
        buildNotification({
          id: `${id}-missing-contact`,
          title: `Missing contact info: ${address}`,
          category: "Deals missing key data",
          priority: "High",
          deal,
          reason: "Seller phone and email are missing.",
          recommendedAction: "Update seller contact details before outreach.",
          action: "open-seller-workspace",
        })
      );
    }

    if (!getDealAliasText(deal, "address") || !getDealAliasText(deal, "ownerName")) {
      notifications.push(
        buildNotification({
          id: `${id}-missing-data`,
          title: `Missing deal data: ${address}`,
          category: "Deals missing key data",
          priority: "Medium",
          deal,
          reason: "Address or seller name is missing.",
          recommendedAction: "Review and clean key deal fields.",
          action: "open-seller-workspace",
        })
      );
    }

    if (stage === "Offer Sent" || deal.offer_ready || deal.offerReadinessScore >= 80) {
      notifications.push(
        buildNotification({
          id: `${id}-offer-review`,
          title: `Offer ready for review: ${address}`,
          category: "Offers ready for review",
          priority: "High",
          deal,
          reason: "Offer status or readiness indicates review is needed.",
          recommendedAction: "Review offer readiness and strategy before seller communication.",
          action: "view-ai-recommendation",
        })
      );
    }

    if (stage === "Under Contract") {
      notifications.push(
        buildNotification({
          id: `${id}-transaction-attention`,
          title: `Transaction needs attention: ${address}`,
          category: "Transactions needing attention",
          priority: "High",
          deal,
          reason: "Deal is under contract and should be tracked through closing.",
          recommendedAction: "View transaction checklist and confirm missing closing items.",
          action: "view-transaction-checklist",
        })
      );
    }

    if (stage && stage !== "Closed" && !deal.next_action) {
      notifications.push(
        buildNotification({
          id: `${id}-workflow-approval`,
          title: `Workflow approval pending: ${address}`,
          category: "Workflow approvals pending",
          priority: "Medium",
          deal,
          reason: "No next action is set for this active deal.",
          recommendedAction: "Requires approval. Review workflow recommendation before acting.",
          action: "view-workflow-approval",
          requiresApproval: true,
        })
      );
    }

    if (!deal.exit_strategy && stage === "Under Contract") {
      notifications.push(
        buildNotification({
          id: `${id}-buyer-review`,
          title: `Buyer match review needed: ${address}`,
          category: "Buyer matches needing review",
          priority: "Medium",
          deal,
          reason: "Under-contract deal does not have a clear exit strategy.",
          recommendedAction: "View buyer matches and disposition strategy.",
          action: "view-buyer-matches",
        })
      );
    }

    if (stage === "Under Contract" && !deal.title_company) {
      notifications.push(
        buildNotification({
          id: `${id}-documents-missing`,
          title: `Documents missing information: ${address}`,
          category: "Documents missing information",
          priority: "Medium",
          deal,
          reason: "Title company or closing documentation data is missing.",
          recommendedAction: "View documents and contract prep checklist.",
          action: "view-documents",
        })
      );
    }
  });

  return notifications;
}

export function buildSystemHealthNotifications(systemHealth = null) {
  if (!systemHealth?.knownWarnings?.length) return [];

  return systemHealth.knownWarnings.slice(0, 5).map((warning, index) =>
    buildNotification({
      id: `system-health-${index}`,
      title: "System health warning",
      category: "System health warnings",
      priority: index === 0 ? "High" : "Medium",
      reason: warning,
      recommendedAction: "Open Admin Health Center and verify configuration.",
      action: "view-system-health",
    })
  );
}
