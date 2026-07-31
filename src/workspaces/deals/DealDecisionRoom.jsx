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
import { analyzeOfferReadiness } from "../../services/offers";
import { getDealIdFromRoute } from "../../navigation/workspaces";
import { getDealAliasText } from "../../utils/dealFields";

const AIInsights = lazy(() => import("../../components/AIInsights"));
const ActivityTimeline = lazy(() => import("../../components/ActivityTimeline"));
const BuyerBlast = lazy(() => import("../../components/BuyerBlast"));
const BuyerMatches = lazy(() => import("../../components/BuyerMatches"));
const CloseoutPanel = lazy(() => import("../../components/CloseoutPanel"));
const CompsEngine = lazy(() => import("../../components/CompsEngine"));
const DealAnalyzer = lazy(() => import("../../components/DealAnalyzer"));
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

function getMissingInformation(deal) {
  const readiness = analyzeOfferReadiness(deal);
  return readiness.checklist.filter((item) => !item.complete).map((item) => item.label);
}

function getRecommendedNextAction(deal) {
  const readiness = analyzeOfferReadiness(deal);
  if (deal?.due_date && deal.due_date < new Date().toISOString().slice(0, 10)) {
    return "Follow up with the seller today and update the next action.";
  }

  if (!getPhone(deal) && !deal?.email) {
    return "Add seller contact information before outreach.";
  }

  return readiness.recommendedNextStep;
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
        description="Derived from the existing offer-readiness checklist."
        title="Missing Information"
      />
      {missingItems.length === 0 ? (
        <p>No required offer-readiness facts are missing from the current deal record.</p>
      ) : (
        <ul>
          {missingItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PrimaryActions({ deal, onAction }) {
  const hasPhone = Boolean(getPhone(deal));

  return (
    <div className="decision-room__actions" aria-label="Decision Room primary actions">
      <Button onClick={() => onAction("numbers")}>Prepare Offer</Button>
      <Button onClick={() => onAction("communication")} variant="secondary">
        Follow Up
      </Button>
      <Button onClick={() => onAction("activity")} variant="secondary">
        Assign
      </Button>
      <Button disabled={!hasPhone} onClick={() => onAction("conversation")} variant="secondary">
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

function DecisionOverview({ deal, missingItems, onAction }) {
  return (
    <div className="decision-room__decision">
      <Card>
        <SectionHeader
          description="Deterministic summary from the currently loaded CRM fields."
          title="Decision Snapshot"
        />
        <FactGrid deal={deal} />
        <div className="decision-room__recommendation">
          <strong>Recommended Next Action:</strong> {getRecommendedNextAction(deal)}
        </div>
        <PrimaryActions deal={deal} onAction={onAction} />
      </Card>
      <MissingInformation missingItems={missingItems} />
      <LazySection label="Loading existing insights...">
        <AIInsights deal={deal} />
      </LazySection>
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

function ActivitySection({ deal, refresh, selectedPhone }) {
  return (
    <PanelSection
      description="Activity, ownership, and follow-up operating history."
      title="Activity"
    >
      <LazySection label="Loading activity timeline...">
        <ActivityTimeline deal={deal} selectedPhone={selectedPhone} />
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
  deals = [],
  loading = false,
  onNavigateWorkspace,
  refresh,
  selectedPhone,
  setSelectedPhone,
}) {
  const [activeSection, setActiveSection] = useState("decision");
  const deal = useMemo(() => findDealByRoute(deals, currentPath), [currentPath, deals]);
  const missingItems = useMemo(() => (deal ? getMissingInformation(deal) : []), [deal]);

  function handlePrimaryAction(action) {
    if (action === "conversation") {
      const phone = getPhone(deal);
      if (phone) setSelectedPhone?.(phone);
      setActiveSection("communication");
      return;
    }

    if (SECTION_IDS.includes(action)) {
      setActiveSection(action);
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
  const readiness = analyzeOfferReadiness(deal);

  function renderActiveSection(sectionId) {
    if (sectionId !== activeSection) return null;

    if (sectionId === "decision") {
      return <DecisionOverview deal={deal} missingItems={missingItems} onAction={handlePrimaryAction} />;
    }

    if (sectionId === "seller") return <SellerSection deal={deal} refresh={refresh} />;
    if (sectionId === "property") return <PropertySection deal={deal} refresh={refresh} />;
    if (sectionId === "numbers") return <NumbersSection deal={deal} refresh={refresh} />;
    if (sectionId === "communication") return <CommunicationSection deal={deal} selectedPhone={selectedPhone} />;
    if (sectionId === "activity") return <ActivitySection deal={deal} refresh={refresh} selectedPhone={selectedPhone} />;
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
          <StatusBadge status={missingItems.length ? "warning" : "success"}>
            {readiness.status}
          </StatusBadge>
          <Badge>{missingItems.length} missing facts</Badge>
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
