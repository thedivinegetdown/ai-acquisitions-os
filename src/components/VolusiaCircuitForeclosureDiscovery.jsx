import { useState } from "react";
import {
  fetchVolusiaCircuitForeclosureCandidates,
  VOLUSIA_CIRCUIT_FORECLOSURE_SOURCE,
} from "../services/leadDiscovery/volusiaCircuitForeclosureSource";
import { fetchVolusiaParcelOwnership } from "../services/leadDiscovery/volusiaParcelOwnershipSource";

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

function formatAddress(address) {
  if (!address) return "Not provided";
  return [
    address.addressLine,
    ...(address.addressLines || []),
    [address.city, address.state, address.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ") || "Not provided";
}

function formatMoney(value) {
  return value === null || value === undefined
    ? "Not provided"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
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
  const [parcelInputs, setParcelInputs] = useState({});
  const [parcelResults, setParcelResults] = useState({});

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

  async function verifyParcel(candidate) {
    const verifiedParcelId = (parcelInputs[candidate.externalId] || "").trim();
    if (!/^\d{7}$/.test(verifiedParcelId)) {
      setParcelResults((current) => ({
        ...current,
        [candidate.externalId]: {
          status: "invalid",
          propertyVerificationState: "UNVERIFIED",
          error: "Enter an independently verified seven-digit Volusia PARID.",
        },
      }));
      return;
    }

    setParcelResults((current) => ({
      ...current,
      [candidate.externalId]: { status: "loading", propertyVerificationState: "UNVERIFIED" },
    }));
    const result = await fetchVolusiaParcelOwnership(verifiedParcelId);
    setParcelResults((current) => ({
      ...current,
      [candidate.externalId]: result.success
        ? result.data
        : {
            status: "unavailable",
            propertyVerificationState: "UNVERIFIED",
            error: result.error?.message || "Volusia Parcel Ownership data is unavailable.",
          },
    }));
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
            {state.candidates.map((candidate) => {
              const parcelResult = parcelResults[candidate.externalId];
              const parcel = parcelResult?.parcel;
              return (
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
                  Report week ending: {formatValue(candidate.reportWeekEnding)} | Property verification state: {parcelResult?.propertyVerificationState || candidate.propertyVerificationState}
                </div>
                <div style={{ color: "#134e4a", fontSize: 13, marginTop: 4 }}>
                  Source: {candidate.source} | Retrieved: {formatValue(candidate.retrievedAt)}
                </div>
                <div style={{ borderTop: "1px solid #ccfbf1", marginTop: 10, paddingTop: 10 }}>
                  <label htmlFor={`parcel-${candidate.externalId}`} style={{ color: "#134e4a", display: "block", fontSize: 13 }}>
                    Independently verified Volusia PARID
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 5 }}>
                    <input
                      id={`parcel-${candidate.externalId}`}
                      inputMode="numeric"
                      maxLength={7}
                      onChange={(event) => setParcelInputs((current) => ({ ...current, [candidate.externalId]: event.target.value }))}
                      placeholder="7-digit PARID"
                      value={parcelInputs[candidate.externalId] || ""}
                    />
                    <button type="button" disabled={parcelResult?.status === "loading"} onClick={() => verifyParcel(candidate)}>
                      {parcelResult?.status === "loading" ? "Verifying..." : "Attach Verified Parcel ID"}
                    </button>
                  </div>
                  {parcelResult?.error && <p role="alert">{parcelResult.error}</p>}
                  {["unmatched", "ambiguous"].includes(parcelResult?.status) && (
                    <p role="status">Exact parcel lookup: {parcelResult.status}. Candidate remains UNVERIFIED.</p>
                  )}
                  {parcelResult?.status === "matched" && parcel && (
                    <section aria-label="Verified parcel enrichment" style={{ background: "#eff6ff", border: "1px solid #93c5fd", marginTop: 8, padding: 8 }}>
                      <strong>Verified parcel enrichment (read-only)</strong>
                      <div>Parcel ID: {parcel.parcelId}</div>
                      <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", marginTop: 5, padding: 6 }}>
                        Verified situs address: {formatAddress(parcel.situsAddress)}
                      </div>
                      <div>Owner: {parcel.ownerNames.length ? parcel.ownerNames.join(" / ") : "Not provided"}</div>
                      <div>Owner mailing address: {formatAddress(parcel.ownerMailingAddress)}</div>
                      <div>Property/use: {[parcel.propertyUse.code, parcel.propertyUse.description].filter(Boolean).join(" — ") || "Not provided"}</div>
                      <div>Beds: {formatValue(parcel.beds)} | Baths: {formatValue(parcel.baths)} | Living area: {formatValue(parcel.livingAreaSquareFeet)} sq ft</div>
                      <div>Calculated acreage: {formatValue(parcel.acreage.calculated)} | Land acreage: {formatValue(parcel.acreage.land)}</div>
                      <div>Just-value context (not ARV): land {formatMoney(parcel.justValueContext.land)} | improvement {formatMoney(parcel.justValueContext.improvement)} | total {formatMoney(parcel.justValueContext.total)}</div>
                      <div>Latest recorded sale (not current value): {formatValue(parcel.latestSale.date)} | {formatMoney(parcel.latestSale.price)}</div>
                      <div>Source: {parcel.source} | Retrieved: {formatValue(parcel.retrievedAt)}</div>
                    </section>
                  )}
                </div>
              </article>
              );
            })}
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
