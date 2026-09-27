import { useEffect, useState } from "react";
import {
  checkVolusiaCodeComplianceAvailability,
  fetchVolusiaCodeComplianceCandidates,
} from "../services/leadDiscovery/volusiaCodeComplianceSource";

const panelStyle = {
  background: "#fefce8",
  border: "2px solid #ca8a04",
  borderRadius: 10,
  marginBottom: 16,
  padding: 14,
};

function formatValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not provided"
    : value;
}

function formatAddress(address) {
  if (!address) return "Not provided";
  return [
    address.addressLine,
    [address.city, address.state, address.postalCode].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ") || "Not provided";
}

export default function VolusiaCodeComplianceDiscovery() {
  const [availability, setAvailability] = useState("checking");
  const [windowDays, setWindowDays] = useState(30);
  const [state, setState] = useState({
    status: "idle",
    candidates: [],
    dateWindow: null,
    retrievedAt: null,
    error: "",
  });

  useEffect(() => {
    let active = true;
    checkVolusiaCodeComplianceAvailability().then((result) => {
      if (!active) return;
      setAvailability(result.success && result.data.available ? "available" : "denied");
    });
    return () => {
      active = false;
    };
  }, []);

  async function loadPreview() {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    const result = await fetchVolusiaCodeComplianceCandidates(windowDays);
    if (!result.success) {
      setState({
        status: "unavailable",
        candidates: [],
        dateWindow: null,
        retrievedAt: null,
        error:
          result.error?.message ||
          "Volusia Code Compliance is unavailable. Choose a narrower window and retry.",
      });
      return;
    }
    setState({
      status: result.data.status,
      candidates: result.data.candidates || [],
      dateWindow: result.data.dateWindow || null,
      retrievedAt: result.data.retrievedAt || null,
      error: "",
    });
  }

  if (availability !== "available") return null;

  return (
    <section aria-label="Internal Volusia Code Compliance" style={panelStyle}>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <div>
          <strong>INTERNAL CODE COMPLIANCE SOURCE</strong>
          <div style={{ color: "#854d0e", fontSize: 12, marginTop: 3 }}>
            INTERNAL OWNER USE ONLY · read-only preview · no deal creation
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <label style={{ color: "#713f12", fontSize: 13 }}>
            Date window{" "}
            <select
              aria-label="Code compliance date window"
              disabled={state.status === "loading"}
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          <button type="button" disabled={state.status === "loading"} onClick={loadPreview}>
            {state.status === "loading" ? "Loading..." : "Refresh Internal Preview"}
          </button>
        </div>
      </div>

      {state.error && <p role="alert">Unavailable: {state.error}</p>}

      {state.status === "available" && (
        <>
          <p aria-live="polite" style={{ color: "#854d0e", fontSize: 13 }}>
            {state.candidates.length} unique cases from {formatValue(state.dateWindow?.startDate)} through {formatValue(state.dateWindow?.endDate)}. Retrieved: {formatValue(state.retrievedAt)}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {state.candidates.map((candidate) => {
              const enrichment = candidate.parcelEnrichment;
              const parcel = enrichment?.parcel;
              return (
                <article key={candidate.externalId} style={{ background: "white", border: "1px solid #fde047", borderRadius: 8, padding: 10 }}>
                  <strong>{candidate.fileNumber}</strong>
                  <div style={{ color: "#713f12", fontSize: 13, marginTop: 4 }}>
                    Type: {formatValue(candidate.complianceType)} | Date: {formatValue(candidate.date)} | Status: {formatValue(candidate.status)}
                  </div>
                  <div style={{ color: "#713f12", fontSize: 13, marginTop: 4 }}>
                    Property PID: {formatValue(candidate.propertyPid)} | Address: {formatValue(candidate.propertyAddress)}
                  </div>
                  <div style={{ color: "#854d0e", fontSize: 12, marginTop: 4 }}>
                    Source: {candidate.source} | FolderRSN: {candidate.folderRsn} | Review: {candidate.reviewState} | Retrieved: {candidate.retrievedAt}
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: 13, marginTop: 6, padding: 7 }}>
                    Source #8 parcel verification: {candidate.propertyVerificationState} ({formatValue(enrichment?.status)})
                    {parcel && (
                      <>
                        <div>Verified PARID: {formatValue(enrichment.verifiedParcelId)}</div>
                        <div>Verified situs address: {formatAddress(parcel.situsAddress)}</div>
                        <div>Property use: {formatValue(parcel.propertyUse?.description)}</div>
                        <div>Beds/Baths: {formatValue(parcel.beds)}/{formatValue(parcel.baths)} | Living area: {formatValue(parcel.livingAreaSquareFeet)} sq ft</div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {state.status === "idle" && (
        <p style={{ color: "#713f12", fontSize: 13, marginBottom: 0 }}>
          Owner-triggered discovery uses a bounded recent date window. Large results fail closed and must be narrowed.
        </p>
      )}
    </section>
  );
}
