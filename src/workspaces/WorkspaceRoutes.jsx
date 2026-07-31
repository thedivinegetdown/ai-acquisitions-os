import { lazy, Suspense } from "react";
import ChatInbox from "../components/ChatInbox";
import ConversationInbox from "../components/ConversationInbox";
import LazyPanelFallback from "../components/LazyPanelFallback";
import PipelineBoard from "../components/PipelineBoard";
import { Button, Card, EmptyState, PageHeader, SectionHeader } from "../design-system";
import TodayWorkspace from "./today/TodayWorkspace";

const DealDecisionRoom = lazy(() => import("./deals/DealDecisionRoom"));
const ConversationThread = lazy(() => import("../components/ConversationThread"));
const ExecutiveDashboard = lazy(() =>
  import("../features/dashboard").then((module) => ({ default: module.ExecutiveDashboard }))
);
const TeamRolesPanel = lazy(() => import("../components/TeamRolesPanel"));
const OrganizationSettingsPanel = lazy(() => import("../components/OrganizationSettingsPanel"));
const SaaSReadinessPanel = lazy(() => import("../components/SaaSReadinessPanel"));
const BillingSubscriptionPanel = lazy(() => import("../components/BillingSubscriptionPanel"));
const AdminHealthCenter = lazy(() => import("../components/AdminHealthCenter"));
const CampaignTrackingPanel = lazy(() => import("../components/CampaignTrackingPanel"));
const SearchCommandCenter = lazy(() => import("../components/SearchCommandCenter"));
const LeadImporter = lazy(() => import("../components/LeadImporter"));
const DuplicateDetector = lazy(() => import("../components/DuplicateDetector"));
const DataHealthCenter = lazy(() => import("../components/DataHealthCenter"));
const AutoLeadScoring = lazy(() => import("../components/AutoLeadScoring"));
const BulkActionsBar = lazy(() => import("../components/BulkActionsBar"));
const SavedViewsBar = lazy(() => import("../components/SavedViewsBar"));
const ExecutiveScorecard = lazy(() => import("../components/ExecutiveScorecard"));
const RevenueBoard = lazy(() => import("../components/RevenueBoard"));
const AnalyticsBoard = lazy(() => import("../components/AnalyticsBoard"));
const DashboardStats = lazy(() => import("../components/DashboardStats"));
const KPIBoard = lazy(() => import("../components/KPIBoard"));
const SourceBoard = lazy(() => import("../components/SourceBoard"));
const BuyersBoard = lazy(() => import("../components/BuyersBoard"));
const SearchFilters = lazy(() => import("../components/SearchFilters"));

function WorkspaceContainer({ children, description, title }) {
  return (
    <section className="workspace">
      <PageHeader description={description} title={title} />
      <div className="workspace__content">{children}</div>
    </section>
  );
}

function CompatibilityGroup({ children, title }) {
  return (
    <Card className="workspace__compatibility" muted>
      <SectionHeader
        description="Temporary compatibility area for existing product capabilities during route migration."
        title={title}
      />
      <div className="workspace__stack">{children}</div>
    </Card>
  );
}

function LazyCompatibility({ children, label }) {
  return <Suspense fallback={<LazyPanelFallback label={label} />}>{children}</Suspense>;
}

function PipelineWorkspace({
  clearSelection,
  deals,
  filteredDeals,
  loading,
  openDeal,
  refresh,
  selectedIds,
  setFilteredDeals,
  toggleSelect,
}) {
  return (
    <WorkspaceContainer
      description="Existing pipeline workflow in a route-level workspace container."
      title="Pipeline"
    >
      <CompatibilityGroup title="Pipeline controls">
        <LazyCompatibility label="Loading pipeline controls...">
          <SearchFilters deals={deals} onChange={setFilteredDeals} />
          <SavedViewsBar deals={deals} applyView={setFilteredDeals} />
          <BulkActionsBar clearSelection={clearSelection} refresh={refresh} selectedIds={selectedIds} />
        </LazyCompatibility>
      </CompatibilityGroup>
      {loading ? (
        <p>Loading deals...</p>
      ) : (
        <PipelineBoard
          deals={filteredDeals}
          openDeal={openDeal}
          refresh={refresh}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
        />
      )}
    </WorkspaceContainer>
  );
}

function InboxWorkspace({ selectedPhone, setSelectedPhone }) {
  return (
    <WorkspaceContainer
      description="Existing seller communication views in a route-level workspace container."
      title="Inbox"
    >
      <ChatInbox />
      <ConversationInbox selectedPhone={selectedPhone} setSelectedPhone={setSelectedPhone} />
      <LazyCompatibility label="Loading seller workspace...">
        <ConversationThread selectedPhone={selectedPhone} />
      </LazyCompatibility>
    </WorkspaceContainer>
  );
}

function DealsWorkspace({ deals, openDeal, setFilteredDeals, setSelectedPhone }) {
  return (
    <WorkspaceContainer
      description="Existing deal and data tools grouped for compatibility during workspace migration."
      title="Deals"
    >
      <CompatibilityGroup title="Deal compatibility panels">
        <LazyCompatibility label="Loading deal panels...">
          <SearchCommandCenter deals={deals} openDeal={openDeal} setSelectedPhone={setSelectedPhone} />
          <LeadImporter deals={deals} />
          <DuplicateDetector applyDuplicates={setFilteredDeals} deals={deals} />
          <DataHealthCenter applyView={setFilteredDeals} deals={deals} />
          <AutoLeadScoring applyView={setFilteredDeals} deals={deals} />
        </LazyCompatibility>
      </CompatibilityGroup>
    </WorkspaceContainer>
  );
}

function BuyersWorkspace() {
  return (
    <WorkspaceContainer
      description="Existing buyer and disposition tools in a dedicated workspace."
      title="Buyers"
    >
      <CompatibilityGroup title="Buyer compatibility panels">
        <LazyCompatibility label="Loading buyer panels...">
          <BuyersBoard />
        </LazyCompatibility>
      </CompatibilityGroup>
    </WorkspaceContainer>
  );
}

function ReportsWorkspace({ deals }) {
  return (
    <WorkspaceContainer
      description="Existing reporting panels grouped under the Reports workspace."
      title="Reports"
    >
      <CompatibilityGroup title="Reporting compatibility panels">
        <LazyCompatibility label="Loading reports...">
          <ExecutiveDashboard deals={deals} />
          <ExecutiveScorecard deals={deals} />
          <RevenueBoard deals={deals} />
          <AnalyticsBoard deals={deals} />
          <DashboardStats deals={deals} />
          <KPIBoard deals={deals} />
          <SourceBoard deals={deals} />
          <CampaignTrackingPanel deals={deals} />
        </LazyCompatibility>
      </CompatibilityGroup>
    </WorkspaceContainer>
  );
}

function SettingsWorkspace({ deals }) {
  return (
    <WorkspaceContainer
      description="Existing organization and platform administration panels."
      title="Settings"
    >
      <CompatibilityGroup title="Settings compatibility panels">
        <LazyCompatibility label="Loading settings...">
          <OrganizationSettingsPanel />
          <TeamRolesPanel />
          <SaaSReadinessPanel />
          <BillingSubscriptionPanel deals={deals} />
          <AdminHealthCenter deals={deals} />
        </LazyCompatibility>
      </CompatibilityGroup>
    </WorkspaceContainer>
  );
}

function UnknownWorkspace({ onNavigateHome }) {
  return (
    <WorkspaceContainer description="The requested workspace route is not available." title="Workspace not found">
      <EmptyState
        action={onNavigateHome ? <Button onClick={onNavigateHome}>Go to Today</Button> : null}
        description="Use the primary navigation to open an available workspace."
        title="Unknown workspace"
      />
    </WorkspaceContainer>
  );
}

export default function WorkspaceRoutes({ workspaceId, isUnknownRoute, onNavigateHome, ...props }) {
  if (isUnknownRoute) return <UnknownWorkspace onNavigateHome={onNavigateHome} />;

  switch (workspaceId) {
    case "today":
      return <TodayWorkspace {...props} />;
    case "pipeline":
      return <PipelineWorkspace {...props} />;
    case "inbox":
      return <InboxWorkspace {...props} />;
    case "deals":
      return <DealsWorkspace {...props} />;
    case "deal-decision-room":
      return (
        <LazyCompatibility label="Loading Deal Decision Room...">
          <DealDecisionRoom {...props} />
        </LazyCompatibility>
      );
    case "buyers":
      return <BuyersWorkspace {...props} />;
    case "reports":
      return <ReportsWorkspace {...props} />;
    case "settings":
      return <SettingsWorkspace {...props} />;
    default:
      return <UnknownWorkspace onNavigateHome={onNavigateHome} />;
  }
}
