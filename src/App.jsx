import { useCallback, useState } from "react";
import { useDealData } from "./hooks/useDealData";
import CommandPalette from "./components/CommandPalette";
import { AppShell } from "./design-system";
import { workspaceDefinitions } from "./navigation/workspaces";
import { useWorkspaceRouter } from "./navigation/useWorkspaceRouter";
import WorkspaceRoutes from "./workspaces/WorkspaceRoutes";
import { getDealAliasText } from "./utils/dealFields";

export default function App() {
const {
deals,
filteredDeals,
setFilteredDeals,
loading,
error,
loadDeals,
} = useDealData();

const [selectedIds, setSelectedIds] = useState([]);
const [selectedPhone, setSelectedPhone] = useState(null);
const [dark, setDark] = useState(
() => typeof window !== "undefined" && localStorage.getItem("ai-theme") === "dark"
);
const {
currentPath,
currentWorkspaceId,
isUnknownRoute,
navigateToDeal,
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
     openDeal={(deal) => navigateToDeal(getDealAliasText(deal, "id"))}
     setFilteredDeals={setFilteredDeals}
   />

  <WorkspaceRoutes
    clearSelection={clearSelection}
    deals={deals}
    dealLoadError={error}
    filteredDeals={filteredDeals}
    isUnknownRoute={isUnknownRoute}
    loading={loading}
    currentPath={currentPath}
    navigateToDeal={navigateToDeal}
    onNavigateHome={() => navigateToWorkspace("today")}
    onNavigateWorkspace={navigateToWorkspace}
    openDeal={(deal) => navigateToDeal(getDealAliasText(deal, "id"))}
    refresh={loadDeals}
    selectedIds={selectedIds}
    selectedPhone={selectedPhone}
    setFilteredDeals={setFilteredDeals}
    setSelectedPhone={setSelectedPhone}
    toggleSelect={toggleSelect}
    workspaceId={currentWorkspaceId}
  />
</AppShell>

);
}
