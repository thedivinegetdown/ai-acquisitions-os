import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  SectionHeader,
  Spinner,
  StatusBadge,
} from "../../design-system/components";
import { useOwnerOperatingReport } from "../../hooks/useOwnerOperatingReport";
import "./reports-workspace.css";

function formatCount(metric) {
  return metric?.status === "available" ? String(metric.value) : "Unavailable";
}

function formatMoney(metric) {
  if (metric?.status !== "available") return "Unavailable";
  return Number(metric.value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatHours(metric) {
  return metric?.status === "available"
    ? `${Number(metric.value).toFixed(1)}h`
    : "Unavailable";
}

function Metric({ formatter = formatCount, label, metric }) {
  const unavailable = metric?.status !== "available";
  return (
    <div className={`owner-report__metric ${unavailable ? "owner-report__metric--unavailable" : ""}`}>
      <dt>{label}</dt>
      <dd>{formatter(metric)}</dd>
      {unavailable && metric?.reason ? <p>{metric.reason}</p> : null}
      {metric?.sampleSize ? <small>{metric.sampleSize} measured response pair{metric.sampleSize === 1 ? "" : "s"}</small> : null}
    </div>
  );
}

function MetricSection({ children, description, title }) {
  return (
    <Card className="owner-report__section">
      <SectionHeader description={description} title={title} />
      <dl className="owner-report__metrics">{children}</dl>
    </Card>
  );
}

export default function ReportsWorkspace({ report: providedReport = null }) {
  const live = useOwnerOperatingReport({ enabled: !providedReport });
  const report = providedReport || live.report;

  if (!providedReport && live.loading) {
    return (
      <section className="workspace">
        <PageHeader description="Durable workload, lifecycle, and financial outcomes." title="Reports" />
        <Spinner label="Loading owner operating report" />
      </section>
    );
  }

  if (!report) {
    return (
      <section className="workspace">
        <PageHeader description="Durable workload, lifecycle, and financial outcomes." title="Reports" />
        <ErrorState
          action={<Button onClick={live.refresh}>Try again</Button>}
          description={live.error || "The report data is not available."}
          title="Could not load owner report"
        />
      </section>
    );
  }

  return (
    <section className="workspace owner-report">
      <PageHeader
        actions={!providedReport ? <Button onClick={live.refresh} variant="secondary">Refresh</Button> : null}
        description="One tenant-scoped operating view built from persisted work, offer, closing, communication, and outcome records."
        eyebrow="Operating measurement"
        title="Owner report"
      />
      <div className="owner-report__evaluated" role="status">
        <StatusBadge status={report.sourceStatus === "complete" ? "success" : "warning"}>
          {report.sourceStatus === "complete" ? "All report sources loaded" : "Partial source data"}
        </StatusBadge>
        <span>Evaluated {new Date(report.evaluatedAt).toLocaleString()}</span>
      </div>

      {report.sourceWarnings.length ? (
        <Card className="owner-report__warning" muted role="alert">
          <strong>Some metrics are unavailable because a source could not be loaded.</strong>
          <ul>
            {report.sourceWarnings.map((warning) => (
              <li key={warning.source}>{warning.source}: {warning.message}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="workspace__content">
        <MetricSection
          description="Current persisted commitments, classified against the evaluation time. Cancelled work is excluded."
          title="Current workload"
        >
          <Metric label="Due today" metric={report.work.due} />
          <Metric label="Overdue" metric={report.work.overdue} />
          <Metric label="Completed" metric={report.work.completed} />
          <Metric label="Waiting / revisit" metric={report.work.waiting} />
        </MetricSection>

        <MetricSection
          description="Deal counts use the current pipeline state; lifecycle milestones use immutable offer and closing history with one count per deal."
          title="Funnel and outcomes"
        >
          <Metric label="Opportunities / deals" metric={report.funnel.opportunities} />
          <Metric label="Active opportunities" metric={report.funnel.activeOpportunities} />
          <Metric label="Qualified opportunities" metric={report.funnel.qualifiedOpportunities} />
          <Metric label="Offers created" metric={report.funnel.offersCreated} />
          <Metric label="Offers sent" metric={report.funnel.offersSent} />
          <Metric label="Accepted offers" metric={report.funnel.acceptedOffers} />
          <Metric label="Contracts" metric={report.funnel.contracts} />
          <Metric label="Closed" metric={report.funnel.closed} />
          <Metric label="Cancelled / lost" metric={report.funnel.cancelledLost} />
        </MetricSection>

        <MetricSection
          description="Measured only from durable message direction and timestamp pairs; no response time is estimated."
          title="Responsiveness"
        >
          <Metric formatter={formatHours} label="Average seller response" metric={report.responsiveness.averageSellerResponseHours} />
          <Metric formatter={formatHours} label="Average team follow-up" metric={report.responsiveness.averageTeamFollowUpHours} />
          <Metric label="Seller replies awaiting follow-up" metric={report.responsiveness.awaitingTeamFollowUp} />
          <Metric formatter={formatHours} label="Oldest awaiting follow-up" metric={report.responsiveness.oldestAwaitingTeamFollowUpHours} />
        </MetricSection>

        <MetricSection
          description="Expected values use only the latest active closing projection. Realized values use only latest closed actuals; cancelled closings are excluded."
          title="Financial results"
        >
          <Metric formatter={formatMoney} label="Expected proceeds / assignment fee" metric={report.financial.expectedProceeds} />
          <Metric formatter={formatMoney} label="Realized proceeds" metric={report.financial.realizedProceeds} />
          <Metric formatter={formatMoney} label="Realized costs" metric={report.financial.realizedCosts} />
          <Metric formatter={formatMoney} label="Realized net contribution" metric={report.financial.realizedNetContribution} />
        </MetricSection>

        <Card className="owner-report__section owner-report__gaps" muted>
          <SectionHeader
            description="These metrics need new durable facts before they can be reported truthfully."
            title="Insufficient data"
          />
          {report.unavailableFacts.map((fact) => (
            <div key={fact.metric}>
              <strong>{fact.metric}</strong>
              <p>Missing: {fact.missingFact}</p>
              <p>Smallest future capture: {fact.futureCapture}</p>
            </div>
          ))}
        </Card>
      </div>
    </section>
  );
}
