import { useState } from "react";
import {
  fetchOrangeCountyCodeEnforcementLienCandidates,
  ORANGE_COUNTY_CODE_ENFORCEMENT_LIEN_SOURCE,
} from "../services/leadDiscovery/orangeCountyCodeEnforcementLienSource";

const panelStyle = {
  background: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: 10,
  marginBottom: 16,
  padding: 14,
};

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "Not provided" : value;
}

function formatNumber(value) {
  return value === null || value === undefined ? "Not provided" : Number(value).toLocaleString();
}

function formatMoney(value) {
  return value === null || value === undefined
    ? "Not provided"
    : Number(value).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

export default function OrangeCountyCodeEnforcementLienDiscovery() {
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
    const result = await fetchOrangeCountyCodeEnforcementLienCandidates({ cursor });
    if (!result.success) {
      setState({
        status: "unavailable",
        candidates: [],
        rejected: [],
        page: null,
        retrievedAt: null,
        error:
          result.error?.message ||
          "Orange County Active Code Enforcement Liens are unavailable.",
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
    <section aria-label="Orange County Active Code Enforcement Liens" style={panelStyle}>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <div>
          <strong>Orange County Active Code Enforcement Liens</strong>
          <div style={{ color: "#9a3412", fontSize: 12, marginTop: 3 }}>
            Candidate discovery only · reported balance is not a payoff · preview does not create deals
          </div>
        </div>
        <button type="button" disabled={state.status === "loading"} onClick={() => loadPage(0)}>
          {state.status === "loading" ? "Loading..." : "Refresh CE Lien Preview"}
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
                <strong>{candidate.lienCaseId}</strong>
                <div style={{ color: "#431407", fontSize: 13, marginTop: 4 }}>
                  Address: {formatValue(candidate.address)} | Parcel: {formatValue(candidate.parcelNumber)}
                </div>
                <div style={{ color: "#431407", fontSize: 13, marginTop: 4 }}>
                  Reported lien balance: {formatMoney(candidate.reportedLienBalance)} | Source: {candidate.source}
                </div>
                <div style={{ color: "#431407", fontSize: 13, marginTop: 4 }}>
                  Retrieved: {formatValue(candidate.retrievedAt)} | OCPA: {formatValue(candidate.enrichment?.status)}
                </div>
                <div style={{ borderTop: "1px solid #ffedd5", color: "#431407", fontSize: 13, marginTop: 8, paddingTop: 8 }}>
                  {candidate.enrichment?.status === "matched" && (
                    <>
                      <div>OCPA address: {formatValue(candidate.enrichment.address)}, {formatValue(candidate.enrichment.city)} {formatValue(candidate.enrichment.zip)}</div>
                      <div>Owner: {formatValue(candidate.enrichment.owner)}</div>
                      <div>
                        Use: {formatValue(candidate.enrichment.propertyUse?.dorCode)} | Beds/Baths: {formatValue(candidate.enrichment.facts?.beds)}/{formatValue(candidate.enrichment.facts?.baths)} | Living area: {formatNumber(candidate.enrichment.facts?.livingArea)} sq ft | Year built: {formatValue(candidate.enrichment.facts?.yearBuilt)}
                      </div>
                      <div>
                        Acreage: {formatValue(candidate.enrichment.facts?.acreage)} | Zoning: {formatValue(candidate.enrichment.facts?.zoning)} | OCPA market/assessment: {formatMoney(candidate.enrichment.assessment?.marketValue)} / {formatMoney(candidate.enrichment.assessment?.assessedValue)}
                      </div>
                    </>
                  )}
                  {candidate.enrichment?.status === "ambiguous" && (
                    <div>Multiple exact parcel records returned; property facts withheld.</div>
                  )}
                  {candidate.enrichment?.status === "unmatched" && (
                    <div>No exact parcel record returned; property facts withheld.</div>
                  )}
                  <div>
                    Enrichment source: {formatValue(candidate.enrichment?.source)} | Retrieved: {formatValue(candidate.enrichment?.retrievedAt)}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {state.rejected.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary>Rejected source rows ({state.rejected.length})</summary>
              <ul>
                {state.rejected.map((row, index) => (
                  <li key={`${row.candidate?.sourceCursor || "row"}-${index}`}>
                    Record {row.candidate?.sourceCursor || "unknown"}: {row.rejectionReasons.join(", ")}
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
          Load a bounded source page to review {ORANGE_COUNTY_CODE_ENFORCEMENT_LIEN_SOURCE} candidates.
        </p>
      )}
    </section>
  );
}
