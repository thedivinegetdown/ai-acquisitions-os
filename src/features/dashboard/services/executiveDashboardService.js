import { analyzeDeal } from "../../../services/dealAnalysis";
import { prioritizeLead } from "../../../services/leadPriority";
import { analyzeOfferReadiness } from "../../../services/offers";
import { formatNonNegativeUsd } from "../../../utils/currency";
import { daysSince } from "../../../utils/dates";
import { getDealAliasPositiveNumber } from "../../../utils/dealFields";
import { clampScore } from "../../../utils/numbers";
import { buildExecutiveInsights } from "./dashboardInsightsService";

const STAGES = [
  "New Lead",
  "Contacted",
  "Offer Sent",
  "Under Contract",
  "Closed",
  "Dead Lead",
];

function toDateKey(value) {
  if (!value) return "";

  return String(value).slice(0, 10);
}

function isThisWeek(value) {
  if (!value) return false;

  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return false;

  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= 7;
}

function getStage(deal) {
  return deal?.stage || "New Lead";
}

function getStageCounts(deals) {
  return STAGES.reduce((counts, stage) => {
    counts[stage] = deals.filter((deal) => getStage(deal) === stage).length;
    return counts;
  }, {});
}

function getSourceRows(deals) {
  const sources = {};

  deals.forEach((deal) => {
    const key = deal.source || "Unknown";
    sources[key] = (sources[key] || 0) + 1;
  });

  return Object.entries(sources).map(([label, value]) => ({ label, value }));
}

function getMonthlyClosings(deals) {
  const months = {};

  deals
    .filter((deal) => getStage(deal) === "Closed" && deal.closing_date)
    .forEach((deal) => {
      const key = String(deal.closing_date).slice(0, 7);
      months[key] = (months[key] || 0) + 1;
    });

  return Object.entries(months)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([label, value]) => ({ label, value }));
}

function getRevenueTrend(deals) {
  const months = {};

  deals
    .filter((deal) => getStage(deal) === "Closed" && deal.closing_date)
    .forEach((deal) => {
      const key = String(deal.closing_date).slice(0, 7);
      months[key] = (months[key] || 0) + Number(deal.assignment_fee || 0);
    });

  return Object.entries(months)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([label, value]) => ({ label, value }));
}

function buildOverview(deals) {
  const today = new Date().toISOString().slice(0, 10);
  const activeDeals = deals.filter(
    (deal) => !["Closed", "Dead Lead"].includes(getStage(deal))
  );
  const aiCriticalLeads = deals.filter(
    (deal) => prioritizeLead({ deal, messages: [] }).priorityLabel === "Critical"
  );
  const offersReady = deals.filter(
    (deal) => analyzeOfferReadiness(deal).status === "Ready to Offer"
  );

  return {
    activeDeals: activeDeals.length,
    newLeadsToday: deals.filter((deal) => toDateKey(deal.created_at) === today).length,
    leadsThisWeek: deals.filter((deal) => isThisWeek(deal.created_at)).length,
    dealsUnderContract: deals.filter((deal) => getStage(deal) === "Under Contract").length,
    closedDeals: deals.filter((deal) => getStage(deal) === "Closed").length,
    deadLeads: deals.filter((deal) => getStage(deal) === "Dead Lead").length,
    followUpsDueToday: deals.filter((deal) => deal.due_date && deal.due_date <= today).length,
    offersReady: offersReady.length,
    aiCriticalLeads: aiCriticalLeads.length,
  };
}

function buildPipeline(deals) {
  const stageCounts = getStageCounts(deals);
  const stalledDeals = deals.filter((deal) => {
    const inactiveDays = daysSince(deal.updated_at || deal.created_at);
    return inactiveDays !== null && inactiveDays >= 14 && !["Closed", "Dead Lead"].includes(getStage(deal));
  });
  const total = Math.max(deals.length, 1);
  const healthyStages =
    stageCounts.Contacted +
    stageCounts["Offer Sent"] +
    stageCounts["Under Contract"] +
    stageCounts.Closed;
  const pipelineHealthScore = clampScore(
    (healthyStages / total) * 80 + (stalledDeals.length === 0 ? 20 : 0)
  );

  return {
    stageCounts,
    stageRows: STAGES.map((stage) => ({ label: stage, value: stageCounts[stage] })),
    funnelRows: STAGES.filter((stage) => stage !== "Dead Lead").map((stage) => ({
      label: stage,
      value: stageCounts[stage],
    })),
    averageDaysInStage: "Insufficient Data",
    stalledDeals,
    pipelineHealthScore,
  };
}

function buildRevenue(deals) {
  const closedDeals = deals.filter((deal) => getStage(deal) === "Closed");
  const underContract = deals.filter((deal) => getStage(deal) === "Under Contract");
  const assignmentRevenue = deals.reduce(
    (sum, deal) => sum + Number(deal.assignment_fee || 0),
    0
  );
  const activeContractValue = underContract.reduce(
    (sum, deal) => sum + Number(deal.price || deal.latest_offer || 0),
    0
  );
  const grossProfit = closedDeals.reduce(
    (sum, deal) => sum + Number(deal.assignment_fee || 0),
    0
  );
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = closedDeals
    .filter((deal) => String(deal.closing_date || "").startsWith(thisMonth))
    .reduce((sum, deal) => sum + Number(deal.assignment_fee || 0), 0);

  return {
    estimatedAssignmentRevenue: {
      value: assignmentRevenue ? formatNonNegativeUsd(assignmentRevenue) : "Insufficient Data",
    },
    estimatedGrossProfit: {
      value: grossProfit ? formatNonNegativeUsd(grossProfit) : "Insufficient Data",
    },
    activeContractValue: {
      value: activeContractValue ? formatNonNegativeUsd(activeContractValue) : "Insufficient Data",
    },
    expectedMonthlyRevenue: {
      value: monthlyRevenue ? formatNonNegativeUsd(monthlyRevenue) : "Insufficient Data",
    },
    expectedQuarterlyRevenue: {
      value: monthlyRevenue ? formatNonNegativeUsd(monthlyRevenue * 3) : "Insufficient Data",
    },
  };
}

function buildPerformance() {
  return {
    averageResponseTime: { value: "Insufficient Data" },
    averageOfferTime: { value: "Insufficient Data" },
    averageContractTime: { value: "Insufficient Data" },
    averageClosingTime: { value: "Insufficient Data" },
    followUpCompletionRate: { value: "Insufficient Data" },
    taskCompletionRate: { value: "Insufficient Data" },
  };
}

function buildNotifications(deals) {
  const today = new Date().toISOString().slice(0, 10);

  return {
    tasksDueToday: deals.filter((deal) => deal.due_date === today),
    followUpsDue: deals.filter((deal) => deal.due_date && deal.due_date <= today),
    dealsMissingData: deals.filter((deal) => analyzeDeal(deal).missingInformation.length > 0),
    transactionsNeedingAttention: deals.filter(
      (deal) => getStage(deal) === "Under Contract" && (!deal.closing_date || !deal.assignment_fee)
    ),
    contractsAwaitingReview: deals.filter(
      (deal) => getStage(deal) === "Offer Sent" || getStage(deal) === "Under Contract"
    ),
  };
}

function buildCharts(deals, pipeline) {
  return {
    pipelineFunnel: pipeline.funnelRows,
    leadSources: getSourceRows(deals),
    dealStatusBreakdown: pipeline.stageRows,
    monthlyClosings: getMonthlyClosings(deals),
    revenueTrend: getRevenueTrend(deals),
  };
}

export function buildExecutiveDashboard(deals = []) {
  const safeDeals = Array.isArray(deals) ? deals : [];
  const overview = buildOverview(safeDeals);
  const pipeline = buildPipeline(safeDeals);
  const revenue = buildRevenue(safeDeals);
  const performance = buildPerformance(safeDeals);
  const notifications = buildNotifications(safeDeals);
  const charts = buildCharts(safeDeals, pipeline);
  const insights = buildExecutiveInsights({
    overview,
    pipeline,
    revenue,
    performance,
    notifications,
  });

  return {
    overview,
    pipeline,
    revenue,
    performance,
    notifications,
    charts,
    insights,
    generatedAt: new Date().toISOString(),
  };
}

export function getDealValueForForecast(deal) {
  return (
    getDealAliasPositiveNumber(deal, "askingPrice") ||
    getDealAliasPositiveNumber(deal, "arv") ||
    0
  );
}
