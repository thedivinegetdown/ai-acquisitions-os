import LeadImporter from "./components/LeadImporter";
import DuplicateDetector from "./components/DuplicateDetector";
import DataHealthCenter from "./components/DataHealthCenter";
import AutoLeadScoring from "./components/AutoLeadScoring";
import MorningBriefing from "./components/MorningBriefing";
import GoalTracker from "./components/GoalTracker";
import LiveActivityFeed from "./components/LiveActivityFeed";
import BulkActionsBar from "./components/BulkActionsBar";
import SavedViewsBar from "./components/SavedViewsBar";
import NotificationsCenter from "./components/NotificationsCenter";
import ExecutiveScorecard from "./components/ExecutiveScorecard";
import RevenueBoard from "./components/RevenueBoard";
import AnalyticsBoard from "./components/AnalyticsBoard";
import DashboardStats from "./components/DashboardStats";
import AutomationBoard from "./components/AutomationBoard";
import PriorityEngine from "./components/PriorityEngine";
import KPIBoard from "./components/KPIBoard";
import SourceBoard from "./components/SourceBoard";
import BuyersBoard from "./components/BuyersBoard";
import TaskDashboard from "./components/TaskDashboard";
import SearchFilters from "./components/SearchFilters";

export const SectionRenderer = ({ sections }) =>
  sections.map(({ Component, props }, index) => (
    <Component key={`${Component.name || "section"}-${index}`} {...props} />
  ));

export const getPageSections = ({
  deals,
  loadDeals,
  setFilteredDeals,
  setSelectedDeal,
  selectedIds,
  clearSelection,
}) => [
  {
    Component: LeadImporter,
    props: { refresh: loadDeals },
  },
  {
    Component: DuplicateDetector,
    props: { deals, applyDuplicates: setFilteredDeals },
  },
  {
    Component: DataHealthCenter,
    props: { deals, applyView: setFilteredDeals },
  },
  {
    Component: AutoLeadScoring,
    props: { deals, applyView: setFilteredDeals },
  },
  {
    Component: MorningBriefing,
    props: { deals },
  },
  {
    Component: GoalTracker,
    props: { deals },
  },
  {
    Component: LiveActivityFeed,
    props: { deals },
  },
  {
    Component: BulkActionsBar,
    props: {
      selectedIds,
      clearSelection,
      refresh: loadDeals,
    },
  },
  {
    Component: SavedViewsBar,
    props: { deals, applyView: setFilteredDeals },
  },
  {
    Component: NotificationsCenter,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    Component: ExecutiveScorecard,
    props: { deals },
  },
  {
    Component: RevenueBoard,
    props: { deals },
  },
  {
    Component: AnalyticsBoard,
    props: { deals },
  },
  {
    Component: DashboardStats,
    props: { deals },
  },
  {
    Component: AutomationBoard,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    Component: PriorityEngine,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    Component: KPIBoard,
    props: { deals },
  },
  {
    Component: SourceBoard,
    props: { deals },
  },
  {
    Component: BuyersBoard,
    props: {},
  },
  {
    Component: TaskDashboard,
    props: { deals, openDeal: setSelectedDeal },
  },
  {
    Component: SearchFilters,
    props: { deals, onChange: setFilteredDeals },
  },
];
