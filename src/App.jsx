import { useEffect, useState } from "react";
import { useDealData } from "./hooks/useDealData";
import PipelineBoard from "./components/PipelineBoard";
import DealModal from "./components/DealModal";
import CommandPalette from "./components/CommandPalette";
import ThemeToggle from "./components/ThemeToggle";
import { pageStyleBase, headerStyle } from "./AppLayout";
import { getPageSections, SectionRenderer } from "./AppSections";

export default function App() {
  const { deals, setDeals, filteredDeals, setFilteredDeals, loading, loadDeals } =
    useDealData();
  const [
    selectedDeal,
    setSelectedDeal,
  ] = useState(null);
  const [
    selectedIds,
    setSelectedIds,
  ] = useState([]);
  const [dark, setDark] =
    useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (localStorage.getItem("ai-theme") === "dark") {
      setDark(true);
    }
  }, []);

  function toggleSelect(id) {
    setSelectedIds(
      (current) =>
        current.includes(id)
          ? current.filter(
              (x) =>
                x !== id
            )
          : [
              ...current,
              id,
            ]
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const isLoaded = !loading;
  const pageBg = dark ? "#020617" : "#ffffff";
  const text = dark ? "#ffffff" : "#0f172a";

  const pageSections = getPageSections({
    deals,
    loadDeals,
    setFilteredDeals,
    setSelectedDeal,
    selectedIds,
    clearSelection,
  });

  return (
    <div
      style={{
        ...pageStyleBase,
        background: pageBg,
        color: text,
      }}
    >
      <CommandPalette
        deals={deals}
        openDeal={
          setSelectedDeal
        }
        setFilteredDeals={
          setFilteredDeals
        }
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

        <ThemeToggle
          dark={dark}
          setDark={setDark}
        />
      </div>

      {isLoaded && <SectionRenderer sections={pageSections} />}

      {loading ? (
        <p>
          Loading deals...
        </p>
      ) : (
        <PipelineBoard
          deals={
            filteredDeals
          }
          openDeal={
            setSelectedDeal
          }
          selectedIds={
            selectedIds
          }
          toggleSelect={
            toggleSelect
          }
          refresh={loadDeals}
        />
      )}

      <DealModal
        deal={selectedDeal}
        close={() =>
          setSelectedDeal(
            null
          )
        }
        refresh={loadDeals}
      />
    </div>
  );
}