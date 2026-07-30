import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useDealData } from "./hooks/useDealData";
import PipelineBoard from "./components/PipelineBoard";
import CommandPalette from "./components/CommandPalette";
import ChatInbox from "./components/ChatInbox";
import ConversationInbox from "./components/ConversationInbox";
import LazyPanelFallback from "./components/LazyPanelFallback";
import { getPageSections, SectionRenderer } from "./AppSections";
import { AppShell, PageHeader } from "./design-system";

const ConversationThread = lazy(() => import("./components/ConversationThread"));
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

const isLoaded = !loading;

const pageSections = useMemo(() => getPageSections({
deals,
loadDeals,
setFilteredDeals,
setSelectedDeal,
setSelectedPhone,
selectedIds,
clearSelection,
}), [
deals,
loadDeals,
setFilteredDeals,
setSelectedDeal,
setSelectedPhone,
selectedIds,
clearSelection,
]);

return (
<AppShell dark={dark} setDark={setDark}>
  <CommandPalette
     deals={deals}
     openDeal={setSelectedDeal}
     setFilteredDeals={setFilteredDeals}
   />

  <PageHeader title="AI Acquisitions OS" />

  <ChatInbox />

  <ConversationInbox
    selectedPhone={selectedPhone}
    setSelectedPhone={setSelectedPhone}
  />

  <Suspense fallback={<LazyPanelFallback label="Loading seller workspace..." />}>
    <ConversationThread
      selectedPhone={selectedPhone}
    />
  </Suspense>

  {isLoaded && (
    <SectionRenderer
      sections={pageSections}
    />
  )}

  {loading ? (
    <p>Loading deals...</p>
  ) : (
    <PipelineBoard
      deals={filteredDeals}
      openDeal={setSelectedDeal}
      selectedIds={selectedIds}
      toggleSelect={toggleSelect}
      refresh={loadDeals}
    />
  )}

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
