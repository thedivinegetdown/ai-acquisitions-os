export function buildExecutiveInsights({
  overview,
  pipeline,
  revenue,
  performance,
  notifications,
}) {
  const insights = [];

  if (overview.followUpsDueToday === 0 && overview.activeDeals > 0) {
    insights.push("Follow-up volume appears low for the active pipeline.");
  }

  if (overview.aiCriticalLeads > 0) {
    insights.push("Several high-priority sellers need management attention.");
  }

  if (pipeline.stageCounts["Offer Sent"] > 0) {
    insights.push("Offer activity is active and should be monitored for follow-up speed.");
  }

  if (pipeline.stageCounts["New Lead"] > overview.activeDeals * 0.5) {
    insights.push("Pipeline is heavily weighted toward early-stage leads.");
  }

  if (pipeline.stageCounts["Under Contract"] > 0 && notifications.transactionsNeedingAttention.length === 0) {
    insights.push("Closing pipeline appears healthy based on available data.");
  }

  if (revenue.estimatedAssignmentRevenue.value === "Insufficient Data") {
    insights.push("Revenue forecast needs assignment fee or projected profit data.");
  }

  if (performance.followUpCompletionRate.value === "Insufficient Data") {
    insights.push("Follow-up completion cannot be measured until task completion data is centralized.");
  }

  return insights.length
    ? insights
    : ["Business intelligence is available, but more operating data will improve insight quality."];
}
