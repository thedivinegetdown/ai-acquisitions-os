import { lazy, memo, Suspense } from "react";
import LazyPanelFallback from "./components/LazyPanelFallback";

const ExecutiveDashboard = lazy(() =>
  import("./features/dashboard").then((module) => ({
    default: module.ExecutiveDashboard,
  }))
);
const TeamRolesPanel = lazy(() => import("./components/TeamRolesPanel"));
const OrganizationSettingsPanel = lazy(() =>
  import("./components/OrganizationSettingsPanel")
);
const SaaSReadinessPanel = lazy(() => import("./components/SaaSReadinessPanel"));
const BillingSubscriptionPanel = lazy(() =>
  import("./components/BillingSubscriptionPanel")
);
const AdminHealthCenter = lazy(() => import("./components/AdminHealthCenter"));
const CampaignTrackingPanel = lazy(() =>
  import("./components/CampaignTrackingPanel")
);
const SearchCommandCenter = lazy(() =>
  import("./components/SearchCommandCenter")
);
const ActionInboxPanel = lazy(() => import("./components/ActionInboxPanel"));
const LeadImporter = lazy(() => import("./components/LeadImporter"));
const DuplicateDetector = lazy(() => import("./components/DuplicateDetector"));
const DataHealthCenter = lazy(() => import("./components/DataHealthCenter"));
const AutoLeadScoring = lazy(() => import("./components/AutoLeadScoring"));
const MorningBriefing = lazy(() => import("./components/MorningBriefing"));
const GoalTracker = lazy(() => import("./components/GoalTracker"));
const LiveActivityFeed = lazy(() => import("./components/LiveActivityFeed"));
const BulkActionsBar = lazy(() => import("./components/BulkActionsBar"));
const SavedViewsBar = lazy(() => import("./components/SavedViewsBar"));
const NotificationsCenter = lazy(() => import("./components/NotificationsCenter"));
const ExecutiveScorecard = lazy(() => import("./components/ExecutiveScorecard"));
const RevenueBoard = lazy(() => import("./components/RevenueBoard"));
const AnalyticsBoard = lazy(() => import("./components/AnalyticsBoard"));
const DashboardStats = lazy(() => import("./components/DashboardStats"));
const AutomationBoard = lazy(() => import("./components/AutomationBoard"));
const PriorityEngine = lazy(() => import("./components/PriorityEngine"));
const KPIBoard = lazy(() => import("./components/KPIBoard"));
const SourceBoard = lazy(() => import("./components/SourceBoard"));
const BuyersBoard = lazy(() => import("./components/BuyersBoard"));
const TaskDashboard = lazy(() => import("./components/TaskDashboard"));
const SearchFilters = lazy(() => import("./components/SearchFilters"));

export const SectionRenderer = memo(function SectionRenderer({ sections }) {
  return sections.map((section) => {
    const PageSection = section.Component;

    return (
      <Suspense
        key={section.id}
        fallback={<LazyPanelFallback label="Loading section..." />}
      >
        <PageSection {...section.props} />
      </Suspense>
    );
  });
});

export const getPageSections = ({
  deals,
  loadDeals,
  setFilteredDeals,
  setSelectedDeal,
  setSelectedPhone,
  selectedIds,
  clearSelection,
}) => [
  {
    id: "executive-dashboard",
    Component: ExecutiveDashboard,
    props: { deals },
  },
  {
    id: "team-roles",
    Component: TeamRolesPanel,
    props: {},
  },
  {
    id: "organization-settings",
    Component: OrganizationSettingsPanel,
    props: {},
  },
  {
    id: "saas-readiness",
    Component: SaaSReadinessPanel,
    props: {},
  },
  {
    id: "billing-subscription",
    Component: BillingSubscriptionPanel,
    props: { deals },
  },
  {
    id: "admin-health",
    Component: AdminHealthCenter,
    props: { deals },
  },
  {
    id: "search-command-center",
    Component: SearchCommandCenter,
    props: { deals, openDeal: setSelectedDeal, setSelectedPhone },
  },
  {
    id: "action-inbox",
    Component: ActionInboxPanel,
    props: { deals, openDeal: setSelectedDeal, setSelectedPhone },
  },
  {
    id: "lead-importer",
    Component: LeadImporter,
    props: { deals },
  },
  {
    id: "duplicate-detector",
    Component: DuplicateDetector,
    props: { deals, applyDuplicates: setFilteredDeals },
  },
  {
    id: "data-health",
    Component: DataHealthCenter,
    props: { deals, applyView: setFilteredDeals },
  },
  {
    id: "auto-lead-scoring",
    Component: AutoLeadScoring,
    props: { deals, applyView: setFilteredDeals },
  },
  {
    id: "morning-briefing",
    Component: MorningBriefing,
    props: { deals },
  },
  {
    id: "goal-tracker",
    Component: GoalTracker,
    props: { deals },
  },
  {
    id: "live-activity",
    Component: LiveActivityFeed,
    props: { deals },
  },
  {
    id: "bulk-actions",
    Component: BulkActionsBar,
    props: {
      selectedIds,
      clearSelection,
      refresh: loadDeals,
    },
  },
  {
    id: "saved-views",
    Component: SavedViewsBar,
    props: { deals, applyView: setFilteredDeals },
  },
  {
    id: "notifications",
    Component: NotificationsCenter,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    id: "executive-scorecard",
    Component: ExecutiveScorecard,
    props: { deals },
  },
  {
    id: "revenue-board",
    Component: RevenueBoard,
    props: { deals },
  },
  {
    id: "analytics-board",
    Component: AnalyticsBoard,
    props: { deals },
  },
  {
    id: "campaign-tracking",
    Component: CampaignTrackingPanel,
    props: { deals },
  },
  {
    id: "dashboard-stats",
    Component: DashboardStats,
    props: { deals },
  },
  {
    id: "automation-board",
    Component: AutomationBoard,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    id: "priority-engine",
    Component: PriorityEngine,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    id: "kpi-board",
    Component: KPIBoard,
    props: { deals },
  },
  {
    id: "source-board",
    Component: SourceBoard,
    props: { deals },
  },
  {
    id: "buyers-board",
    Component: BuyersBoard,
    props: {},
  },
  {
    id: "task-dashboard",
    Component: TaskDashboard,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    id: "search-filters",
    Component: SearchFilters,
    props: { deals, onChange: setFilteredDeals },
  },
];
