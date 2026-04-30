import { useState } from "react";

export default function SearchFilters({
  deals,
  onChange,
}) {
  const [query, setQuery] =
    useState("");
  const [stage, setStage] =
    useState("");

  function runSearch(
    text,
    selectedStage
  ) {
    const q = text
      .toLowerCase()
      .trim();

    const results = deals.filter(
      (deal) => {
        const searchable = [
          deal.property_address,
          deal.owner_name,
          deal.acquisitions_rep,
          deal.dispositions_rep,
          deal.source,
          deal.notes,
          deal.stage,
        ]
          .join(" ")
          .toLowerCase();

        const matchQuery =
          q === "" ||
          searchable.includes(
            q
          );

        const matchStage =
          selectedStage ===
            "" ||
          deal.stage ===
            selectedStage;

        return (
          matchQuery &&
          matchStage
        );
      }
    );

    onChange(results);
  }

  function handleQuery(value) {
    setQuery(value);
    runSearch(
      value,
      stage
    );
  }

  function handleStage(value) {
    setStage(value);
    runSearch(
      query,
      value
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border:
          "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
        display: "grid",
        gap: 10,
      }}
    >
      <h2
        style={{
          margin: 0,
        }}
      >
        Global Command Bar
      </h2>

      <input
        placeholder="Search address, owner, rep, source, notes..."
        value={query}
        onChange={(e) =>
          handleQuery(
            e.target.value
          )
        }
      />

      <select
        value={stage}
        onChange={(e) =>
          handleStage(
            e.target.value
          )
        }
      >
        <option value="">
          All Stages
        </option>
        <option value="New Lead">
          New Lead
        </option>
        <option value="Contacted">
          Contacted
        </option>
        <option value="Offer Sent">
          Offer Sent
        </option>
        <option value="Under Contract">
          Under Contract
        </option>
        <option value="Closed">
          Closed
        </option>
      </select>
    </div>
  );
}