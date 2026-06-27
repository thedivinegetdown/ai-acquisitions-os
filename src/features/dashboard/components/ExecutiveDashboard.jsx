import { memo, useMemo } from "react";
import { useExecutiveDashboard } from "../hooks/useExecutiveDashboard";
import { DashboardWidget, MetricGrid } from "./DashboardWidget";
import { ChartPanel } from "./SimpleCharts";

function ListPanel({ title, items, getLabel, emptyText = "None right now." }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 16 }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ color: "#64748b", marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          {items.slice(0, 6).map((item, index) => (
            <li key={`${title}-${index}`}>{getLabel(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightPanel({ insights }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 16 }}>Rule-Based Executive Insights</h3>
      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
        {insights.map((insight) => (
          <li key={insight}>{insight}</li>
        ))}
      </ul>
    </div>
  );
}

function ExecutiveDashboard({ deals }) {
  const dashboard = useExecutiveDashboard(deals);
  const overviewMetrics = useMemo(
    () =>
      [
        ["Active Deals", dashboard.overview.activeDeals],
        ["New Leads Today", dashboard.overview.newLeadsToday],
        ["Leads This Week", dashboard.overview.leadsThisWeek],
        ["Under Contract", dashboard.overview.dealsUnderContract],
        ["Closed Deals", dashboard.overview.closedDeals],
        ["Dead Leads", dashboard.overview.deadLeads],
        ["Follow-Ups Due Today", dashboard.overview.followUpsDueToday],
        ["Offers Ready", dashboard.overview.offersReady],
        ["AI Critical Leads", dashboard.overview.aiCriticalLeads],
      ].map(([label, value]) => ({ label, value })),
    [dashboard.overview]
  );
  const revenueMetrics = useMemo(
    () =>
      [
        ["Estimated Assignment Revenue", dashboard.revenue.estimatedAssignmentRevenue.value],
        ["Estimated Gross Profit", dashboard.revenue.estimatedGrossProfit.value],
        ["Active Contract Value", dashboard.revenue.activeContractValue.value],
        ["Expected Monthly Revenue", dashboard.revenue.expectedMonthlyRevenue.value],
        ["Expected Quarterly Revenue", dashboard.revenue.expectedQuarterlyRevenue.value],
      ].map(([label, value]) => ({ label, value })),
    [dashboard.revenue]
  );
  const performanceMetrics = useMemo(
    () =>
      [
        ["Average Response Time", dashboard.performance.averageResponseTime.value],
        ["Average Offer Time", dashboard.performance.averageOfferTime.value],
        ["Average Contract Time", dashboard.performance.averageContractTime.value],
        ["Average Closing Time", dashboard.performance.averageClosingTime.value],
        ["Follow-Up Completion Rate", dashboard.performance.followUpCompletionRate.value],
        ["Task Completion Rate", dashboard.performance.taskCompletionRate.value],
      ].map(([label, value]) => ({ label, value })),
    [dashboard.performance]
  );

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 8,
        padding: 18,
        marginBottom: 24,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            Executive Dashboard
          </div>
          <strong style={{ color: "#0f172a", fontSize: 28 }}>
            Business Intelligence
          </strong>
        </div>
        <span
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 999,
            color: "#334155",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Updated {new Date(dashboard.generatedAt).toLocaleString()}
        </span>
      </div>

      <DashboardWidget title="Business Overview">
        <MetricGrid metrics={overviewMetrics} />
      </DashboardWidget>

      <DashboardWidget title="Pipeline Analytics">
        <MetricGrid
          metrics={[
            { label: "Pipeline Health Score", value: `${dashboard.pipeline.pipelineHealthScore}/100` },
            { label: "Average Days in Stage", value: dashboard.pipeline.averageDaysInStage },
            { label: "Stalled Deals", value: dashboard.pipeline.stalledDeals.length },
          ]}
        />
      </DashboardWidget>

      <DashboardWidget title="Revenue Forecast">
        <MetricGrid metrics={revenueMetrics} />
      </DashboardWidget>

      <DashboardWidget title="Acquisition Performance">
        <MetricGrid metrics={performanceMetrics} />
      </DashboardWidget>

      <DashboardWidget title="AI Business Insights">
        <InsightPanel insights={dashboard.insights} />
      </DashboardWidget>

      <DashboardWidget title="Notifications">
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <ListPanel
            title="Tasks Due Today"
            items={dashboard.notifications.tasksDueToday}
            getLabel={(deal) => deal.property_address || "Unknown property"}
          />
          <ListPanel
            title="Follow-Ups Due"
            items={dashboard.notifications.followUpsDue}
            getLabel={(deal) => deal.property_address || "Unknown property"}
          />
          <ListPanel
            title="Deals Missing Data"
            items={dashboard.notifications.dealsMissingData}
            getLabel={(deal) => deal.property_address || "Unknown property"}
          />
          <ListPanel
            title="Transactions Needing Attention"
            items={dashboard.notifications.transactionsNeedingAttention}
            getLabel={(deal) => deal.property_address || "Unknown property"}
          />
          <ListPanel
            title="Contracts Awaiting Review"
            items={dashboard.notifications.contractsAwaitingReview}
            getLabel={(deal) => deal.property_address || "Unknown property"}
          />
        </div>
      </DashboardWidget>

      <DashboardWidget title="Charts">
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <ChartPanel title="Pipeline Funnel" rows={dashboard.charts.pipelineFunnel} />
          <ChartPanel title="Lead Sources" rows={dashboard.charts.leadSources} />
          <ChartPanel title="Deal Status Breakdown" rows={dashboard.charts.dealStatusBreakdown} />
          <ChartPanel title="Monthly Closings" rows={dashboard.charts.monthlyClosings} />
          <ChartPanel title="Revenue Trend" rows={dashboard.charts.revenueTrend} />
        </div>
      </DashboardWidget>
    </div>
  );
}

export default memo(ExecutiveDashboard);
