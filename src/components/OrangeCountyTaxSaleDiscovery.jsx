import { useState } from "react";
import {
  fetchOrangeCountyTaxSaleCandidates,
  ORANGE_COUNTY_TAX_SALE_SOURCE,
} from "../services/leadDiscovery/orangeCountyTaxSaleSource";

const panelStyle = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 10,
  marginBottom: 16,
  padding: 14,
};

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "Not provided" : value;
}

export default function OrangeCountyTaxSaleDiscovery() {
  const [state, setState] = useState({
    status: "idle",
    candidates: [],
    rejected: [],
    page: null,
    retrievedAt: null,
    error: "",
  });

  async function loadPage(cursor = 0) {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    const result = await fetchOrangeCountyTaxSaleCandidates({ cursor });
    if (!result.success) {
      setState({
        status: "unavailable",
        candidates: [],
        rejected: [],
        page: null,
        retrievedAt: null,
        error: result.error?.message || "Orange County Tax Sale Data is unavailable.",
      });
      return;
    }

    setState({
      status: result.data.status,
      candidates: result.data.candidates || [],
      rejected: result.data.rejected || [],
      page: result.data.page || null,
      retrievedAt: result.data.retrievedAt || null,
      error: "",
    });
  }

  return (
    <section aria-label="Orange County Tax Sale Data" style={panelStyle}>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <div>
          <strong>Orange County Tax Sale Data</strong>
          <div style={{ color: "#9a3412", fontSize: 12, marginTop: 3 }}>
            Candidate discovery only · preview does not create deals
          </div>
        </div>
        <button type="button" disabled={state.status === "loading"} onClick={() => loadPage(0)}>
          {state.status === "loading" ? "Loading..." : "Refresh Tax Sale Preview"}
        </button>
      </div>

      {state.error && <p role="alert">Unavailable: {state.error}</p>}

      {state.status === "available" && (
        <>
          <p aria-live="polite" style={{ color: "#7c2d12", fontSize: 13 }}>
            {state.candidates.length} candidates ready for owner review; {state.rejected.length} rows rejected.
            {state.retrievedAt ? ` Retrieved ${state.retrievedAt}.` : ""}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {state.candidates.map((candidate) => (
              <article key={candidate.externalId} style={{ background: "white", border: "1px solid #fed7aa", borderRadius: 8, padding: 10 }}>
                <strong>{candidate.externalTaxDeedNumber}</strong>
                <div style={{ color: "#431407", fontSize: 13, marginTop: 4 }}>
                  Source: {candidate.source} | Parcel: {candidate.parcelNumber} | Sale date: {formatValue(candidate.saleDate)} | Status: {formatValue(candidate.deedStatus)}
                </div>
              </article>
            ))}
          </div>
          {state.rejected.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary>Rejected source rows ({state.rejected.length})</summary>
              <ul>
                {state.rejected.map((row, index) => (
                  <li key={`${row.candidate?.sourceRecordId || "row"}-${index}`}>
                    Record {row.candidate?.sourceRecordId || "unknown"}: {row.rejectionReasons.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {state.page?.hasMore && (
            <button type="button" onClick={() => loadPage(state.page.nextCursor)} style={{ marginTop: 10 }}>
              Next source page
            </button>
          )}
        </>
      )}

      {state.status === "idle" && (
        <p style={{ color: "#7c2d12", fontSize: 13, marginBottom: 0 }}>
          Load a bounded source page to review {ORANGE_COUNTY_TAX_SALE_SOURCE} candidates.
        </p>
      )}
    </section>
  );
}
