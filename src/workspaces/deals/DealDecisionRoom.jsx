import { lazy, Suspense, useMemo, useState } from "react";
import LazyPanelFallback from "../../components/LazyPanelFallback";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  StatusBadge,
  Tabs,
} from "../../design-system";
import { buildCompatibilityDecisionReadModel } from "../../services/decision-intelligence";
import { getDealIdFromRoute } from "../../navigation/workspaces";
import { formatSafeDate } from "../../utils/dates";
import { getDealAliasText } from "../../utils/dealFields";

const AIInsights = lazy(() => import("../../components/AIInsights"));
const ActivityTimeline = lazy(() => import("../../components/ActivityTimeline"));
const BuyerBlast = lazy(() => import("../../components/BuyerBlast"));
const BuyerMatches = lazy(() => import("../../components/BuyerMatches"));
const CloseoutPanel = lazy(() => import("../../components/CloseoutPanel"));
const CompsEngine = lazy(() => import("../../components/CompsEngine"));
const DealAnalyzer = lazy(() => import("../../components/DealAnalyzer"));
const DealTimeline = lazy(() => import("./DealTimeline"));
const DocumentContractPrepPanel = lazy(() => import("../../components/DocumentContractPrepPanel"));
const DocumentVault = lazy(() => import("../../components/DocumentVault"));
const MessageCenter = lazy(() => import("../../components/MessageCenter"));
const NegotiationTracker = lazy(() => import("../../components/NegotiationTracker"));
const OfferEngine = lazy(() => import("../../components/OfferEngine"));
const PropertyIntelligencePanel = lazy(() => import("../../components/PropertyIntelligencePanel"));
const SequenceEngine = lazy(() => import("../../components/SequenceEngine"));
const TaskPanel = lazy(() => import("../../components/TaskPanel"));
const TeamPanel = lazy(() => import("../../components/TeamPanel"));

const SECTION_IDS = [
  "decision",
  "seller",
  "property",
  "numbers",
  "communication",
  "activity",
  "documents",
  "closing",
];

const SECTION_LABELS = {
  decision: "Decision",
  seller: "Seller",
  property: "Property",
  numbers: "Numbers",
  communication: "Communication",
  activity: "Activity",
  documents: "Documents",
  closing: "Closing",
};

const EMPTY_DECISION_CONTEXT = Object.freeze({});

const LIFECYCLE_STATUS = {
  Identify: "neutral",
  Verify: "warning",
  Decide: "info",
  Act: "info",
  Learn: "success",
};

const PRIMARY_FACTS = [
  { id: "property", label: "Property", value: (deal) => getDealAliasText(deal, "address") || "Unknown property" },
  { id: "seller", label: "Seller", value: (deal) => getDealAliasText(deal, "ownerName") || "Unknown seller" },
  { id: "stage", label: "Current stage", value: (deal) => getDealAliasText(deal, "stage") || "New Lead" },
  { id: "assigned", label: "Assigned user", value: (deal) => deal.owner_name || deal.acquisitions_rep || "Unassigned" },
  { id: "status", label: "Current status", value: (deal) => deal.status || deal.negotiation_status || "Needs review" },
];

function getDealId(deal = {}) {
  return getDealAliasText(deal, "id") || "";
}

function findDealByRoute(deals = [], route = "") {
  const routeDealId = getDealIdFromRoute(route);
  if (!routeDealId) return null;

  return deals.find((deal) => String(getDealId(deal)) === String(routeDealId)) || null;
}

function getPhone(deal = {}) {
  return getDealAliasText(deal, "phone") || deal.phone_number || "";
}

function PanelSection({ children, description, title }) {
  return (
    <Card className="decision-room__section">
      <SectionHeader description={description} title={title} />
      <div className="decision-room__section-body">{children}</div>
    </Card>
  );
}

function LazySection({ children, label }) {
  return <Suspense fallback={<LazyPanelFallback label={label} />}>{children}</Suspense>;
}

function FactGrid({ deal }) {
  return (
    <dl className="decision-room__facts" aria-label="Deal summary facts">
      {PRIMARY_FACTS.map((fact) => (
        <div key={fact.id}>
          <dt>{fact.label}</dt>
          <dd>{fact.value(deal)}</dd>
        </div>
      ))}
    </dl>
  );
}

function MissingInformation({ missingItems }) {
  return (
    <Card className="decision-room__missing" muted>
      <SectionHeader
        description="Open compatibility issues that block or qualify the current decision."
        title="Missing Information"
      />
      {missingItems.length === 0 ? (
        <p>No decision-critical compatibility facts are missing from the current deal record.</p>
      ) : (
        <ul>
          {missingItems.map((item) => (
            <li key={item.issueId}>
              <strong>{item.label}</strong>
              {item.severity === "blocking" ? " - Blocking" : ""}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PrimaryActions({ actions, onAction }) {
  const actionById = Object.fromEntries(actions.map((action) => [action.id, action]));

  function runAction(actionId) {
    const action = actionById[actionId];
    if (!action?.enabled) return;
    onAction(actionId === "view-conversation" ? "conversation" : action.targetSection);
  }

  return (
    <div className="decision-room__actions" aria-label="Decision Room primary actions">
      <Button
        disabled={!actionById["prepare-offer"]?.enabled}
        onClick={() => runAction("prepare-offer")}
      >
        Prepare Offer
      </Button>
      <Button
        disabled={!actionById["follow-up"]?.enabled}
        onClick={() => runAction("follow-up")}
        variant="secondary"
      >
        Follow Up
      </Button>
      <Button
        disabled={!actionById.assign?.enabled}
        onClick={() => runAction("assign")}
        variant="secondary"
      >
        Assign
      </Button>
      <Button
        disabled={!actionById["view-conversation"]?.enabled}
        onClick={() => runAction("view-conversation")}
        variant="secondary"
      >
        View Conversation
      </Button>
      <Button
        disabled
        title="Mark Waiting is not connected to a current safe workflow yet."
        variant="secondary"
      >
        Mark Waiting
      </Button>
      <Button disabled title="Archive is intentionally deferred to avoid changing CRM records." variant="secondary">
        Archive
      </Button>
    </div>
  );
}

function readinessStatus(value) {
  if (value === "Ready to Offer") return "success";
  if (value === "Ready to Analyze") return "info";
  if (value === "Needs Info") return "warning";
  return "neutral";
}

function DecisionOverview({ deal, decisionResult, onAction }) {
  if (!decisionResult?.success) {
    return (
      <Card>
        <SectionHeader
          description="The existing deal remains available, but its deterministic decision summary failed."
          title="Decision Snapshot"
        />
        <ErrorState
          description={
            decisionResult?.error?.message ||
            "Decision information could not be evaluated from the current record."
          }
          title="Decision information unavailable"
        />
      </Card>
    );
  }

  const readModel = decisionResult.data;
  const readiness = readModel.metricsById["offer-readiness"];
  const approval = readModel.approvalSummary;

  return (
    <div className="decision-room__decision">
      <Card>
        <SectionHeader
          description="Deterministic compatibility summary from the currently loaded CRM fields."
          title="Decision Snapshot"
        />
        <div className="decision-room__decision-statuses" aria-label="Current decision states">
          <StatusBadge status={LIFECYCLE_STATUS[readModel.lifecycle.state] || "neutral"}>
            Lifecycle: {readModel.lifecycle.state || "Not evaluated"}
          </StatusBadge>
          {readiness?.evaluationState === "compatibility-result" ? (
            <StatusBadge status={readinessStatus(readiness.displayValue)}>
              Offer readiness: {readiness.displayValue}
            </StatusBadge>
          ) : null}
          <Badge>Deterministic compatibility</Badge>
        </div>
        <FactGrid deal={deal} />
        <div className="decision-room__recommendation">
          <span>Current lifecycle</span>
          <strong>{readModel.lifecycle.state || "Not evaluated"}</strong>
          <p>{readModel.lifecycle.reason || "No lifecycle reason is available."}</p>
          <span>Recommended Next Action</span>
          <strong>{readModel.recommendation.label || "Needs review"}</strong>
          <p>{readModel.recommendation.explanation}</p>
        </div>
        <dl className="decision-room__decision-meta">
          <div>
            <dt>Approval context</dt>
            <dd>{approval.status === "unavailable" ? "Not supplied" : approval.status}</dd>
          </div>
          <div>
            <dt>Last evaluated</dt>
            <dd>{formatSafeDate(readModel.lifecycle.evaluatedTimestamp, "Not available")}</dd>
          </div>
        </dl>
        {readModel.sourceStatus === "partial" ? (
          <p className="decision-room__partial-warning" role="status">
            Decision basis is partial. Review the source and compatibility warnings below.
          </p>
        ) : null}
        <PrimaryActions actions={readModel.availableActions} onAction={onAction} />
      </Card>
      <MissingInformation missingItems={readModel.missingInformationReferences} />
      <Card className="decision-room__basis" muted>
        <details>
          <summary>Decision Basis</summary>
          <div className="decision-room__basis-content">
            <dl className="decision-room__decision-meta">
              <div>
                <dt>Ruleset</dt>
                <dd>
                  {readModel.ruleset.rulesetId} / {readModel.ruleset.rulesetVersion}
                </dd>
              </div>
              <div>
                <dt>Source mode</dt>
                <dd>Deterministic compatibility</dd>
              </div>
              <div>
                <dt>Source freshness</dt>
                <dd>{readModel.sourceFreshness.state}</dd>
              </div>
              <div>
                <dt>Latest source timestamp</dt>
                <dd>
                  {formatSafeDate(
                    readModel.sourceFreshness.latestSourceTimestamp,
                    "Not available"
                  )}
                </dd>
              </div>
            </dl>
            <h3>Evidence and Provenance</h3>
            {readModel.evidenceReferences.length ? (
              <ul className="decision-room__evidence-list">
                {readModel.evidenceReferences.map((entry) => (
                  <li key={entry.evidenceId}>
                    <strong>{entry.sourceSystem}</strong>
                    <span>
                      {entry.sourceType}
                      {entry.sourceField ? ` / ${entry.sourceField}` : ""}
                    </span>
                    <span>{entry.valueSummary || "Current field is present"}</span>
                    <span>
                      Source timestamp: {formatSafeDate(entry.sourceTimestamp, "Not available")};
                      verification: {entry.verificationState}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No source evidence is available for this compatibility record.</p>
            )}
            {readModel.sourceWarnings.length ? (
              <div className="decision-room__source-warnings">
                <h3>Source warnings</h3>
                <ul>
                  {readModel.sourceWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      </Card>
      <Card className="decision-room__ai-separation" muted>
        <SectionHeader
          description="This existing optional panel is separate from the deterministic compatibility recommendation above."
          eyebrow="Optional"
          title="AI-assisted insight"
        />
        <LazySection label="Loading existing insights...">
          <AIInsights deal={deal} />
        </LazySection>
      </Card>
    </div>
  );
}

function SellerSection({ deal, refresh }) {
  return (
    <PanelSection
      description="Seller identity, ownership, tasking, and assignment context."
      title="Seller"
    >
      <FactGrid deal={deal} />
      <LazySection label="Loading seller tasks...">
        <TaskPanel deal={deal} refresh={refresh} />
      </LazySection>
      <LazySection label="Loading team assignment...">
        <TeamPanel deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

function PropertySection({ deal, refresh }) {
  return (
    <PanelSection
      description="Property facts, comps, and existing property intelligence tools."
      title="Property"
    >
      <LazySection label="Loading property intelligence...">
        <PropertyIntelligencePanel deal={deal} />
      </LazySection>
      <LazySection label="Loading comps...">
        <CompsEngine deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

function NumbersSection({ deal, refresh }) {
  return (
    <PanelSection
      description="Existing underwriting, offer, and negotiation tools."
      title="Numbers"
    >
      <LazySection label="Loading deal analyzer...">
        <DealAnalyzer deal={deal} refresh={refresh} />
      </LazySection>
      <LazySection label="Loading offer engine...">
        <OfferEngine deal={deal} />
      </LazySection>
      <LazySection label="Loading negotiation tracker...">
        <NegotiationTracker deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

function CommunicationSection({ deal, selectedPhone }) {
  return (
    <PanelSection
      description="Seller messages and follow-up sequencing."
      title="Communication"
    >
      <LazySection label="Loading messages...">
        <MessageCenter deal={deal} />
      </LazySection>
      <LazySection label="Loading follow-up sequence...">
        <SequenceEngine deal={deal} />
      </LazySection>
      <LazySection label="Loading seller activity...">
        <ActivityTimeline deal={deal} selectedPhone={selectedPhone} />
      </LazySection>
    </PanelSection>
  );
}

function ActivitySection({ deal, onOpenContext, refresh }) {
  return (
    <PanelSection
      description="Activity, ownership, and follow-up operating history."
      title="Activity"
    >
      <LazySection label="Loading activity timeline...">
        <DealTimeline deal={deal} onOpenContext={onOpenContext} />
      </LazySection>
      <LazySection label="Loading task panel...">
        <TaskPanel deal={deal} refresh={refresh} />
      </LazySection>
      <LazySection label="Loading team panel...">
        <TeamPanel deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

function DocumentsSection({ deal }) {
  return (
    <PanelSection
      description="Document storage and existing contract-preparation checklist."
      title="Documents"
    >
      <LazySection label="Loading document prep...">
        <DocumentContractPrepPanel deal={deal} />
      </LazySection>
      <LazySection label="Loading document vault...">
        <DocumentVault deal={deal} />
      </LazySection>
    </PanelSection>
  );
}

function ClosingSection({ deal, refresh }) {
  return (
    <PanelSection
      description="Disposition, buyer matching, and closeout workflow surfaces."
      title="Closing"
    >
      <LazySection label="Loading buyer matches...">
        <BuyerMatches deal={deal} />
      </LazySection>
      <LazySection label="Loading buyer blast...">
        <BuyerBlast deal={deal} />
      </LazySection>
      <LazySection label="Loading closeout...">
        <CloseoutPanel deal={deal} refresh={refresh} />
      </LazySection>
    </PanelSection>
  );
}

// New component reason: the existing DealModal has the right business panels,
// but cannot provide route-level navigation, breadcrumbs, or section ownership.
export default function DealDecisionRoom({
  currentPath = "",
  decisionContext = EMPTY_DECISION_CONTEXT,
  deals = [],
  loading = false,
  onNavigateWorkspace,
  refresh,
  selectedPhone,
  setSelectedPhone,
}) {
  const [activeSection, setActiveSection] = useState("decision");
  const deal = useMemo(() => findDealByRoute(deals, currentPath), [currentPath, deals]);
  const decisionResult = useMemo(
    () =>
      deal
        ? buildCompatibilityDecisionReadModel({
            ...decisionContext,
            deal,
          })
        : null,
    [deal, decisionContext]
  );

  function handlePrimaryAction(action) {
    if (action === "conversation") {
      const phone = getPhone(deal);
      if (phone) setSelectedPhone?.(phone);
      if (onNavigateWorkspace) {
        onNavigateWorkspace("inbox");
      } else {
        setActiveSection("communication");
      }
      return;
    }

    if (SECTION_IDS.includes(action)) {
      setActiveSection(action);
    }
  }

  function handleTimelineContext(event) {
    const action = event?.availableActions?.[0];
    if (!action) return;

    if (action.targetWorkspace === "inbox") {
      const phone = event.sellerReference?.phone || getPhone(deal);
      if (phone) setSelectedPhone?.(phone);
      onNavigateWorkspace?.("inbox");
      return;
    }

    if (
      action.targetWorkspace &&
      action.targetWorkspace !== "deal-decision-room"
    ) {
      onNavigateWorkspace?.(action.targetWorkspace);
      return;
    }

    if (SECTION_IDS.includes(action.targetSection)) {
      setActiveSection(action.targetSection);
    }
  }

  if (loading) {
    return (
      <section className="workspace decision-room">
        <PageHeader description="Loading the selected opportunity." title="Deal Decision Room" />
        <Card>Loading deal...</Card>
      </section>
    );
  }

  if (!deal) {
    return (
      <section className="workspace decision-room">
        <PageHeader
          actions={
            <Button onClick={() => onNavigateWorkspace?.("deals")} variant="secondary">
              Back to Deals
            </Button>
          }
          description="The requested deal route does not match a currently loaded deal."
          title="Deal not found"
        />
        <ErrorState
          description="Refresh deal data or return to Deals to choose an available record."
          title="Unable to open Decision Room"
        />
      </section>
    );
  }

  const address = getDealAliasText(deal, "address") || "Unknown property";
  const seller = getDealAliasText(deal, "ownerName") || "Unknown seller";
  const stage = getDealAliasText(deal, "stage") || "New Lead";
  const decisionReadModel = decisionResult?.success ? decisionResult.data : null;
  const readiness = decisionReadModel?.metricsById["offer-readiness"];
  const missingCount = decisionReadModel?.missingInformationReferences.length || 0;

  function renderActiveSection(sectionId) {
    if (sectionId !== activeSection) return null;

    if (sectionId === "decision") {
      return (
        <DecisionOverview
          deal={deal}
          decisionResult={decisionResult}
          onAction={handlePrimaryAction}
        />
      );
    }

    if (sectionId === "seller") return <SellerSection deal={deal} refresh={refresh} />;
    if (sectionId === "property") return <PropertySection deal={deal} refresh={refresh} />;
    if (sectionId === "numbers") return <NumbersSection deal={deal} refresh={refresh} />;
    if (sectionId === "communication") return <CommunicationSection deal={deal} selectedPhone={selectedPhone} />;
    if (sectionId === "activity") {
      return (
        <ActivitySection
          deal={deal}
          onOpenContext={handleTimelineContext}
          refresh={refresh}
        />
      );
    }
    if (sectionId === "documents") return <DocumentsSection deal={deal} />;

    return <ClosingSection deal={deal} refresh={refresh} />;
  }

  const tabs = SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    label: SECTION_LABELS[sectionId],
    content: renderActiveSection(sectionId),
  }));

  return (
    <section className="workspace decision-room">
      <PageHeader
        actions={
          <Button onClick={() => onNavigateWorkspace?.("deals")} variant="secondary">
            Back to Deals
          </Button>
        }
        description="One guided workspace for deciding, communicating, and moving this opportunity forward."
        eyebrow="Deals / Decision Room"
        title={address}
      />
      <nav aria-label="Breadcrumb" className="decision-room__breadcrumb">
        <button onClick={() => onNavigateWorkspace?.("deals")} type="button">
          Deals
        </button>
        <span aria-hidden="true">/</span>
        <span>{address}</span>
      </nav>

      <Card className="decision-room__hero">
        <div>
          <h2>{address}</h2>
          <p>{seller}</p>
        </div>
        <div className="decision-room__hero-badges">
          <StatusBadge status="info">{stage}</StatusBadge>
          <StatusBadge status={readinessStatus(readiness?.displayValue)}>
            {readiness?.displayValue || "Readiness unavailable"}
          </StatusBadge>
          <Badge>{missingCount} missing facts</Badge>
        </div>
      </Card>

      {deals.length === 0 ? (
        <EmptyState
          description="No deal records are loaded, so the Decision Room cannot resolve this route."
          title="No deals loaded"
        />
      ) : (
        <Card className="decision-room__tabs">
          <Tabs
            activeId={activeSection}
            ariaLabel="Deal Decision Room sections"
            onChange={setActiveSection}
            tabs={tabs}
          />
        </Card>
      )}
    </section>
  );
}
