import { memo, useDeferredValue, useMemo, useState } from "react";
import {
  DEFAULT_SEARCH_FILTERS,
  getCommandAction,
  runGlobalSearch,
} from "../services/search";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

const fieldStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  width: "100%",
};

const entityLabels = {
  seller: "Sellers",
  deal: "Deals",
  phone: "Phone Numbers",
  property: "Properties",
  conversation: "Conversations",
  task: "Tasks",
  buyer: "Buyers",
  transaction: "Transactions",
  document: "Documents",
  campaign: "Campaigns",
  ai: "AI Recommendations",
  workflow: "Workflow Items",
};

function Field({ label, children }) {
  return (
    <label>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

const ResultCard = memo(function ResultCard({ result, onOpenDeal, onSelectPhone }) {
  const action = getCommandAction(result.action);

  function runAction() {
    if (result.deal && ["open-deal", "open-seller-workspace"].includes(result.action)) {
      onOpenDeal?.(result.deal);
      return;
    }

    if (result.action === "open-conversation") {
      onSelectPhone?.(result.deal?.phone || result.title);
    }
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong>{result.title}</strong>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
            {result.subtitle}
          </div>
        </div>
        <span
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 999,
            color: "#334155",
            fontSize: 12,
            fontWeight: 800,
            padding: "5px 8px",
          }}
        >
          {result.type}
        </span>
      </div>
      <p style={{ color: "#334155", margin: "8px 0" }}>{result.description}</p>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>
        Stage: {result.stage || "Any"} | Market: {result.market || "Unknown"} |
        Source: {result.leadSource || "Unknown"} | Status: {result.status || "Unknown"}
      </div>
      <button
        type="button"
        onClick={runAction}
        style={{
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          color: "#0f172a",
          cursor: "pointer",
          fontWeight: 800,
          padding: "8px 10px",
        }}
      >
        {action.label}
      </button>
    </div>
  );
});

export default function SearchCommandCenter({
  deals = [],
  openDeal,
  setSelectedPhone,
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_SEARCH_FILTERS);
  const deferredQuery = useDeferredValue(query);
  const search = useMemo(
    () => runGlobalSearch({ query: deferredQuery, filters, deals }),
    [deals, filters, deferredQuery]
  );

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        marginBottom: 24,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Search / Command Center
          </div>
          <h2 style={{ color: "#0f172a", margin: "4px 0 0" }}>
            Advanced Search
          </h2>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Search across sellers, deals, conversations, tasks, buyers,
            transactions, documents, campaigns, AI insights, and workflows.
          </p>
        </div>
        <span
          style={{
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            borderRadius: 999,
            color: "#166534",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
            alignSelf: "flex-start",
          }}
        >
          View actions only
        </span>
      </div>

      <div style={{ ...cardStyle, display: "grid", gap: 10, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search seller, address, phone, task, source, status, AI recommendation..."
          style={{ ...fieldStyle, fontSize: 16 }}
        />
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <Field label="Entity Type">
            <select
              value={filters.entityType}
              onChange={(event) => updateFilter("entityType", event.target.value)}
              style={fieldStyle}
            >
              {search.filters.options.entityTypes.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All types" : entityLabels[option] || option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pipeline Stage">
            <select
              value={filters.stage}
              onChange={(event) => updateFilter("stage", event.target.value)}
              style={fieldStyle}
            >
              {search.filters.options.stages.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Market">
            <select
              value={filters.market}
              onChange={(event) => updateFilter("market", event.target.value)}
              style={fieldStyle}
            >
              {search.filters.options.markets.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Lead Source">
            <select
              value={filters.leadSource}
              onChange={(event) => updateFilter("leadSource", event.target.value)}
              style={fieldStyle}
            >
              {search.filters.options.leadSources.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={filters.priority}
              onChange={(event) => updateFilter("priority", event.target.value)}
              style={fieldStyle}
            >
              {search.filters.options.priorities.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              style={fieldStyle}
            >
              {search.filters.options.statuses.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="Date From">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              style={fieldStyle}
            />
          </Field>
          <Field label="Date To">
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              style={fieldStyle}
            />
          </Field>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <div style={cardStyle}>
          <strong>{search.results.length}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Results</div>
        </div>
        <div style={cardStyle}>
          <strong>{Object.keys(search.groupedResults).length}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Groups</div>
        </div>
        <div style={cardStyle}>
          <strong>{search.suggestedActions.length}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Suggested Actions</div>
        </div>
      </div>

      {search.suggestedActions.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <strong>Suggested Actions</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {search.suggestedActions.map((action) => (
              <span
                key={action.id}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "6px 9px",
                }}
              >
                {action.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {search.results.length === 0 ? (
          <div style={cardStyle}>{search.summary}</div>
        ) : (
          Object.entries(search.groupedResults).map(([type, results]) => (
            <div key={type} style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>{entityLabels[type] || type}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {results.slice(0, 6).map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    onOpenDeal={openDeal}
                    onSelectPhone={setSelectedPhone}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {search.missingData.length > 0 && (
        <div style={{ ...cardStyle, color: "#64748b", marginTop: 12 }}>
          <strong>Index Notes:</strong> {search.missingData.join(" ")}
        </div>
      )}
    </section>
  );
}
