import { useEffect, useMemo, useState } from "react";
import { Button, Card, SectionHeader } from "../../design-system";
import { formatNonNegativeUsd } from "../../utils/currency";
import {
  getRentCastPropertyDataStatus,
  refreshRentCastPropertyData,
} from "../../services/propertyData";
import { saveResearchCommand } from "../../services/repositories/researchRepository";

function display(value) {
  return value === null || value === undefined || value === "" ? "Unknown" : String(value);
}

function comparison(current, provider) {
  if (provider === null || provider === undefined || provider === "") return "Provider value unavailable";
  if (current === null || current === undefined || current === "") return "Current fact is unknown";
  return String(current).trim().toLowerCase() === String(provider).trim().toLowerCase()
    ? "Matches current fact"
    : `Differs from current fact (${display(current)})`;
}

function finding(label, value, current) {
  return { label, value, comparison: comparison(current, value) };
}

export default function RentCastPropertyEvidencePanel({ deal, onSaved }) {
  const [state, setState] = useState({ loading: true, busy: false, provider: null, evidence: null, error: "", message: "" });
  useEffect(() => {
    let active = true;
    getRentCastPropertyDataStatus(deal).then((result) => {
      if (!active) return;
      if (result.success) setState((current) => ({ ...current, loading: false, provider: result.data.provider, evidence: result.data.evidence }));
      else setState((current) => ({ ...current, loading: false, error: result.error?.message || "Provider status is unavailable." }));
    });
    return () => { active = false; };
  }, [deal]);

  const data = state.evidence?.data;
  const isLand = deal.asset_type === "vacant-residential-land";
  const findings = useMemo(() => data ? [
    finding("Property type", data.property?.propertyType, deal.property_type),
    finding("Bedrooms", data.property?.beds, deal.bedrooms),
    finding("Bathrooms", data.property?.baths, deal.bathrooms),
    finding("Living area", data.property?.squareFeet, deal.square_feet ?? deal.square_footage),
    finding("Lot size", data.property?.lotSize, deal.land_square_feet ?? deal.lot_size),
    finding("Assessor / parcel ID", data.property?.assessorId, deal.parcel_number ?? deal.parcel_id),
    finding("Zoning", data.property?.zoning, deal.zoning),
    finding("County", data.property?.county, deal.county),
    finding("Estimated value (AVM)", data.valuation?.estimatedValue, isLand ? deal.comparable_land_value : deal.arv),
  ].filter((entry) => entry.value !== null && entry.value !== undefined && entry.value !== "") : [], [data, deal, isLand]);

  async function refresh() {
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    const result = await refreshRentCastPropertyData(deal);
    if (result.success) {
      setState((current) => ({ ...current, busy: false, provider: result.data.provider, evidence: result.data.evidence, message: result.data.cacheHit ? "Fresh cached evidence reused; no provider request was made." : "RentCast evidence refreshed." }));
    } else {
      setState((current) => ({ ...current, busy: false, error: result.error?.message || "RentCast property data is unavailable." }));
    }
  }

  async function accept({ field, value, sourceType, providerField, limitation, sourceTimestamp = "" }) {
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    const result = await saveResearchCommand(deal, {
      type: "record",
      field,
      value: String(value),
      source: `rentcast:${state.evidence.id}:${providerField}`,
      sourceType,
      verificationState: "unverified",
      sourceTimestamp,
      providerEvidence: {
        provider: "rentcast",
        evidenceId: state.evidence.id,
        providerRecordId: state.evidence.providerRecordId,
        providerField,
        retrievedAt: state.evidence.retrievedAt,
        limitation,
      },
    });
    if (result.success) {
      onSaved(result.data);
      setState((current) => ({ ...current, busy: false, message: "Provider-backed fact recorded. Resolve any disagreement in the existing research panel." }));
    } else {
      setState((current) => ({ ...current, busy: false, error: result.error?.message || "Provider-backed fact could not be recorded." }));
    }
  }

  const estimatedValue = data?.valuation?.estimatedValue;
  const zoning = data?.property?.zoning;
  const providerStatus = !state.provider?.enabled ? "Disabled" : !state.provider?.configured ? "Missing server key" : "Available";

  return <Card className="workspace__stack">
    <SectionHeader title="RentCast property evidence" description="Optional provider evidence only. Refreshing never overwrites deal facts; accepting a finding uses the existing research and conflict-resolution path." />
    {state.loading ? <p>Loading provider status…</p> : <>
      <p><strong>Provider status:</strong> {providerStatus}</p>
      {state.evidence && <p><strong>Last retrieved:</strong> {state.evidence.retrievedAt} — {state.evidence.cacheState} cache</p>}
      <Button disabled={state.busy || !state.provider?.enabled || !state.provider?.configured} onClick={refresh}>Refresh Property Data</Button>
      {data && <>
        <ul aria-label="RentCast normalized findings">{findings.map((entry) => <li key={entry.label}>
          <strong>{entry.label}:</strong> {entry.label.includes("value") && typeof entry.value === "number" ? formatNonNegativeUsd(entry.value) : display(entry.value)} — {entry.comparison}
        </li>)}</ul>
        {data.tax && <p>Tax/assessment context: {display(data.tax.taxYear)} assessed {data.tax.assessedValue == null ? "Unknown" : formatNonNegativeUsd(data.tax.assessedValue)}, annual tax {data.tax.annualTaxes == null ? "Unknown" : formatNonNegativeUsd(data.tax.annualTaxes)}.</p>}
        <p>Sale history records: {data.saleHistory?.length || 0}. Comparable listing observations: {data.comps?.length || 0}.</p>
        {isLand && zoning && <Button disabled={state.busy} onClick={() => accept({ field: "property.zoning", value: zoning, sourceType: "property-record", providerField: "property.zoning", limitation: "County-record zoning may lag or require local verification." })}>Record zoning evidence</Button>}
        {estimatedValue != null && <Button disabled={state.busy} onClick={() => accept({
          field: isLand ? "property.comparableLandValue" : "property.afterRepairValue",
          value: estimatedValue,
          sourceType: "provider-valuation",
          providerField: "valuation.estimatedValue",
          limitation: isLand ? "Provider AVM is indicated land-value evidence, not manual underwriting." : "Provider AVM is current-value evidence and is not automatically ARV.",
          sourceTimestamp: state.evidence.retrievedAt,
        })}>{isLand ? "Record AVM as land-value evidence" : "Record AVM as ARV evidence"}</Button>}
        <ul aria-label="RentCast limitations">{(data.limitations || []).map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </>}
      {state.message && <p role="status">{state.message}</p>}
      {state.error && <p role="alert">{state.error} Manual research remains available.</p>}
    </>}
  </Card>;
}
