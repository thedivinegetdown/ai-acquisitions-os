import { lazy, Suspense, useCallback, useState } from "react";
import { useDealData } from "./hooks/useDealData";
import CommandPalette from "./components/CommandPalette";
import LazyPanelFallback from "./components/LazyPanelFallback";
import { AppShell } from "./design-system";
import { workspaceDefinitions } from "./navigation/workspaces";
import { useWorkspaceRouter } from "./navigation/useWorkspaceRouter";
import WorkspaceRoutes from "./workspaces/WorkspaceRoutes";

const DealModal = lazy(() => import("./components/DealModal"));

export default function App() {
const {
deals,
filteredDeals,
setFilteredDeals,
loading,
loadDeals,
} = useDealData();

const [selectedDeal, setSelectedDeal] = useState(null);
const [selectedIds, setSelectedIds] = useState([]);
const [selectedPhone, setSelectedPhone] = useState(null);
const [dark, setDark] = useState(
() => typeof window !== "undefined" && localStorage.getItem("ai-theme") === "dark"
);
const {
currentWorkspaceId,
isUnknownRoute,
navigateToWorkspace,
} = useWorkspaceRouter();

const toggleSelect = useCallback((id) => {
setSelectedIds((current) =>
current.includes(id)
? current.filter((x) => x !== id)
: [...current, id]
);
}, []);

const clearSelection = useCallback(() => {
setSelectedIds([]);
}, []);

return (
<AppShell
  currentWorkspaceId={currentWorkspaceId}
  dark={dark}
  navigationItems={workspaceDefinitions}
  onNavigate={navigateToWorkspace}
  setDark={setDark}
>
  <CommandPalette
     deals={deals}
     openDeal={setSelectedDeal}
     setFilteredDeals={setFilteredDeals}
   />

  <WorkspaceRoutes
    clearSelection={clearSelection}
    deals={deals}
    filteredDeals={filteredDeals}
    isUnknownRoute={isUnknownRoute}
    loading={loading}
    onNavigateHome={() => navigateToWorkspace("today")}
    openDeal={setSelectedDeal}
    refresh={loadDeals}
    selectedIds={selectedIds}
    selectedPhone={selectedPhone}
    setFilteredDeals={setFilteredDeals}
    setSelectedPhone={setSelectedPhone}
    toggleSelect={toggleSelect}
    workspaceId={currentWorkspaceId}
  />

  {selectedDeal && (
    <Suspense fallback={<LazyPanelFallback label="Loading deal modal..." />}>
      <DealModal
        deal={selectedDeal}
        close={() => setSelectedDeal(null)}
        refresh={loadDeals}
      />
    </Suspense>
  )}
</AppShell>

);
}
