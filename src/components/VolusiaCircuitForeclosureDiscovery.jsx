import { useState } from "react";
import {
  fetchVolusiaCircuitForeclosureCandidates,
  VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE,
} from "../services/leadDiscovery/volusiaCircuitForeclosureSource";

const panelStyle = {
  background: "#f0fdfa",
  border: "1px solid #5eead4",
  borderRadius: 10,
  marginBottom: 16,
  padding: 14,
};

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "Not provided" : value;
}

export default function VolusiaCircuitForeclosureDiscovery() {
  const [state, setState] = useState({
    status: "idle",
    candidates: [],
    rejected: [],
    reports: [],
    retrievedAt: null,
    error: "",
  });

  async function loadPreview() {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    const result = await fetchVolusiaCircuitForeclosureCandidates();
    if (!result.success) {
      setState({
        status: "unavailable",
        candidates: [],
        rejected: [],
        reports: [],
        retrievedAt: null,
        error:
          result.error?.message ||
          "Volusia weekly circuit foreclosure reports are unavailable.",
      });
      return;
    }

    setState({
      status: result.data.status,
      candidates: result.data.candidates || [],
      rejected: result.data.rejected || [],
      reports: result.data.reports || [],
      retrievedAt: result.data.retrievedAt || null,
      error: "",
    });
  }

  return (
    <section aria-label="Volusia Weekly Circuit Foreclosure Filings" style={panelStyle}>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <div>
          <strong>Volusia Weekly Circuit Foreclosure Filings</strong>
          <div style={{ color: "#115e59", fontSize: 12, marginTop: 3 }}>
            Read-only candidate preview · latest four weekly reports · no deal creation
          </div>
        </div>
        <button type="button" disabled={state.status === "loading"} onClick={loadPreview}>
          {state.status === "loading" ? "Loading..." : "Refresh Foreclosure Preview"}
        </button>
      </div>

      {state.error && <p role="alert">Unavailable: {state.error}</p>}

      {state.status === "available" && (
        <>
          <p aria-live="polite" style={{ color: "#115e59", fontSize: 13 }}>
            {state.candidates.length} unique candidates from {state.reports.length} weekly reports; {state.rejected.length} rows rejected or deduplicated.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {state.candidates.map((candidate) => (
              <article key={candidate.externalId} style={{ background: "white", border: "1px solid #99f6e4", borderRadius: 8, padding: 10 }}>
                <strong>{formatValue(candidate.caseNumber)}</strong>
                <div style={{ color: "#134e4a", fontSize: 13, marginTop: 4 }}>
                  Filing date: {formatValue(candidate.filingDate)} | Judge: {formatValue(candidate.judge)}
                </div>
                <div style={{ color: "#134e4a", fontSize: 13, marginTop: 4 }}>
                  Plaintiff: {formatValue(candidate.plaintiff)}
                </div>
                <div style={{ color: "#134e4a", fontSize: 13, marginTop: 4 }}>
                  Defendant: {formatValue(candidate.defendant)}
                </div>
                <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", fontSize: 13, marginTop: 6, padding: 7 }}>
                  Party/report address (NOT VERIFIED PROPERTY ADDRESS): {formatValue(candidate.partyReportAddress)}
                </div>
                <div style={{ color: "#134e4a", fontSize: 13, marginTop: 4 }}>
                  Report week ending: {formatValue(candidate.reportWeekEnding)} | Property verification state: {candidate.propertyVerificationState}
                </div>
                <div style={{ color: "#134e4a", fontSize: 13, marginTop: 4 }}>
                  Source: {candidate.source} | Retrieved: {formatValue(candidate.retrievedAt)}
                </div>
              </article>
            ))}
          </div>
          {state.rejected.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary>Rejected or duplicate report rows ({state.rejected.length})</summary>
              <ul>
                {state.rejected.map((row, index) => (
                  <li key={`${row.candidate?.reportWeekEnding || "report"}-${row.candidate?.sourceRow || index}-${index}`}>
                    {formatValue(row.candidate?.caseNumber)}: {row.rejectionReasons.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {state.status === "idle" && (
        <p style={{ color: "#115e59", fontSize: 13, marginBottom: 0 }}>
          Load a bounded four-report window to review {VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE} candidates.
        </p>
      )}
    </section>
  );
}
