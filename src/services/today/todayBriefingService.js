import { TODAY_CATEGORY_LABELS } from "./todayService";

function plural(count, singular, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function countByType(items = [], type) {
  return items.filter((item) => item.type === type).length;
}

export function buildTodayBriefing(readModel = {}) {
  const items = Array.isArray(readModel.items) ? readModel.items : [];
  const counts = readModel.counts || {};
  const urgentCount = (counts["act-now"] || 0) + (counts["at-risk"] || 0);
  const sellerReplyCount = countByType(items, "seller-reply");
  const approvalCount = counts.approvals || 0;
  const atRiskCount = counts["at-risk"] || 0;
  const waitingCount = counts.waiting || 0;
  const dueFollowUpCount = items.filter((item) =>
    String(item.source || item.title || "").toLowerCase().includes("follow")
  ).length;
  const criticalDelayCount = items.filter((item) => item.delayImpact === "critical").length;
  const highDelayCount = items.filter((item) => item.delayImpact === "high").length;
  const focus = items.find((item) => ["at-risk", "act-now", "approvals"].includes(item.category)) || null;

  if (items.length === 0) {
    return {
      generatedAt: readModel.generatedAt || new Date().toISOString(),
      counts: {
        urgentActions: 0,
        sellerReplies: 0,
        approvals: 0,
        atRisk: 0,
        dueOrOverdueFollowUps: 0,
        waiting: 0,
        criticalDelay: 0,
        highDelay: 0,
      },
      focusItemId: null,
      focusText: "No immediate acquisition work is queued from the currently loaded data.",
      summary: "No Today items require attention from the currently loaded data.",
      sourceStatus: readModel.sourceStatus || "complete",
      warnings: readModel.sourceWarnings || [],
    };
  }

  const clauses = [
    `${plural(urgentCount, "item")} requiring attention now`,
    sellerReplyCount ? `${plural(sellerReplyCount, "seller reply", "seller replies")} needing response` : "",
    approvalCount ? `${plural(approvalCount, "approval")} waiting` : "",
    atRiskCount ? `${plural(atRiskCount, "deal")} at risk` : "",
  ].filter(Boolean);

  const sourceNote =
    readModel.sourceStatus === "partial"
      ? " Some source data is incomplete, so review the visible warnings."
      : "";

  return {
    generatedAt: readModel.generatedAt || new Date().toISOString(),
    counts: {
      urgentActions: urgentCount,
      sellerReplies: sellerReplyCount,
      approvals: approvalCount,
      atRisk: atRiskCount,
      dueOrOverdueFollowUps: dueFollowUpCount,
      waiting: waitingCount,
      criticalDelay: criticalDelayCount,
      highDelay: highDelayCount,
    },
    focusItemId: focus?.id || null,
    focusText: focus
      ? `Start with ${focus.title}: ${focus.recommendedNextAction}`
      : `Review ${TODAY_CATEGORY_LABELS.waiting} items when scheduled.`,
    summary: `You have ${plural(items.length, "Today item")} from the currently loaded data. ${clauses.join(", ")}.${sourceNote}`,
    sourceStatus: readModel.sourceStatus || "complete",
    warnings: readModel.sourceWarnings || [],
  };
}
