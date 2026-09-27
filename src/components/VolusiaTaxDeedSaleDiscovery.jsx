import { useState } from "react";
import {
  fetchVolusiaTaxDeedSaleCandidates,
  VOLUSIA_TAX_DEED_SALE_SOURCE,
} from "../services/leadDiscovery/volusiaTaxDeedSaleSource";

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

function formatAddress(address) {
  if (!address) return "Not provided";
  return [
    address.addressLine,
    [address.city, address.state, address.postalCode].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ") || "Not provided";
}

function formatMoney(value) {
  return value === null || value === undefined
    ? "Not provided"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function VolusiaTaxDeedSaleDiscovery() {
  const [state, setState] = useState({
    status: "idle",
    candidates: [],
    rejected: [],
    saleWindow: [],
    retrievedAt: null,
    error: "",
  });

  async function loadPreview() {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    const result = await fetchVolusiaTaxDeedSaleCandidates();
    if (!result.success) {
      setState({
        status: "unavailable",
        candidates: [],
        rejected: [],
        saleWindow: [],
        retrievedAt: null,
        error: result.error?.message || "Volusia Tax Deed Sales are unavailable.",
      });
      return;
    }
    setState({
      status: result.data.status,
      candidates: result.data.candidates || [],
      rejected: result.data.rejected || [],
      saleWindow: result.data.saleWindow || [],
      retrievedAt: result.data.retrievedAt || null,
      error: "",
    });
  }

  return (
    <section aria-label="Volusia Tax Deed Sales" style={panelStyle}>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
        <div>
          <strong>Volusia Tax Deed Sales</strong>
          <div style={{ color: "#9a3412", fontSize: 12, marginTop: 3 }}>
            TAX DEED SALE / AUCTION OPPORTUNITY · not a direct seller-motivation lead · no deal creation
          </div>
        </div>
        <button type="button" disabled={state.status === "loading"} onClick={loadPreview}>
          {state.status === "loading" ? "Loading..." : "Refresh Tax Deed Preview"}
        </button>
      </div>

      {state.error && <p role="alert">Unavailable: {state.error}</p>}

      {state.status === "available" && (
        <>
          <p aria-live="polite" style={{ color: "#9a3412", fontSize: 13 }}>
            {state.candidates.length} unique auction candidates from {state.saleWindow.length} recent sale date; {state.rejected.length} source rows rejected. Retrieved: {formatValue(state.retrievedAt)}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {state.candidates.map((candidate) => {
              const enrichment = candidate.parcelEnrichment;
              const parcel = enrichment?.parcel;
              return (
                <article key={candidate.externalId} style={{ background: "white", border: "1px solid #fed7aa", borderRadius: 8, padding: 10 }}>
                  <strong>{candidate.opportunityType}</strong>
                  <div style={{ color: "#7c2d12", fontSize: 13, marginTop: 4 }}>
                    Certificate: {formatValue(candidate.certificateNumber)} | Parcel: {formatValue(candidate.parcelNumber)}
                  </div>
                  <div style={{ color: "#7c2d12", fontSize: 13, marginTop: 4 }}>
                    Sale date: {formatValue(candidate.saleDate)} | Status: {formatValue(candidate.status)} | Status date: {formatValue(candidate.statusDate)}
                  </div>
                  <div style={{ color: "#7c2d12", fontSize: 13, marginTop: 4 }}>
                    Opening bid: {formatMoney(candidate.openingBid)}
                  </div>
                  <div style={{ color: "#7c2d12", fontSize: 12, marginTop: 4 }}>
                    Source: {candidate.source} | Retrieved: {formatValue(candidate.retrievedAt)}
                  </div>
                  <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: 13, marginTop: 6, padding: 7 }}>
                    Parcel verification: {candidate.propertyVerificationState} ({formatValue(enrichment?.status)})
                    {parcel && (
                      <>
                        <div>Source #8 PARID: {formatValue(enrichment.verifiedParcelId)}</div>
                        <div>Verified situs address: {formatAddress(parcel.situsAddress)}</div>
                        <div>Owner(s): {parcel.ownerNames?.length ? parcel.ownerNames.join("; ") : "Not provided"}</div>
                        <div>Property use: {formatValue(parcel.propertyUse?.description)}</div>
                        <div>Beds/Baths: {formatValue(parcel.beds)}/{formatValue(parcel.baths)} | Living area: {formatValue(parcel.livingAreaSquareFeet)} sq ft</div>
                        <div>Just-value context (not market value or equity): {formatMoney(parcel.justValueContext?.total)}</div>
                        <div>Latest recorded sale: {formatValue(parcel.latestSale?.date)} · {formatMoney(parcel.latestSale?.price)}</div>
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
        <p style={{ color: "#7c2d12", fontSize: 13, marginBottom: 0 }}>
          Load the latest completed Clerk sale date for a bounded {VOLUSIA_TAX_DEED_SALE_SOURCE} preview.
        </p>
      )}
    </section>
  );
}
