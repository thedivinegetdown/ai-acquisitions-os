import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useDealData } from "./hooks/useDealData";
import PipelineBoard from "./components/PipelineBoard";
import CommandPalette from "./components/CommandPalette";
import ThemeToggle from "./components/ThemeToggle";
import ChatInbox from "./components/ChatInbox";
import ConversationInbox from "./components/ConversationInbox";
import LazyPanelFallback from "./components/LazyPanelFallback";
import AuthStatus from "./components/AuthStatus";
import { pageStyleBase, headerStyle } from "./AppLayout";
import { getPageSections, SectionRenderer } from "./AppSections";

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
const [dark, setDark] = useState(false);

useEffect(() => {
if (typeof window === "undefined") return;

if (localStorage.getItem("ai-theme") === "dark") {
  setDark(true);
}

}, []);

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

const pageBg = dark ? "#020617" : "#ffffff";
const text = dark ? "#ffffff" : "#0f172a";

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
<div
style={{
...pageStyleBase,
background: pageBg,
color: text,
}}
> <CommandPalette
     deals={deals}
     openDeal={setSelectedDeal}
     setFilteredDeals={setFilteredDeals}
   />

  <div style={headerStyle}>
    <h1
      style={{
        fontSize: 52,
        margin: 0,
      }}
    >
      AI Acquisitions OS
    </h1>

    <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
      <AuthStatus />
      <ThemeToggle
        dark={dark}
        setDark={setDark}
      />
    </div>
  </div>

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
</div>

);
}
