import React, { useRef, useState } from "react";

const fields = [
  ["listingName", "Listing source name", "text", true],
  ["listingUrl", "Listing source URL", "url", true],
  ["listingRetrievedAt", "Listing retrieval date", "datetime-local", true],
  ["parid", "Official Volusia PARID (seven digits)", "text", true],
  ["originalParcel", "Original PID / parcel identifier (optional)", "text"],
  ["location", "Address / location", "text", true],
  ["listingPrice", "Observed public listing price (optional)", "number"],
  ["listingZoning", "Listing zoning claim (optional)", "text"],
  ["countyZoning", "Reviewed official county zoning (optional)", "text"],
  ["countyZoningUrl", "Official county zoning source URL (required with zoning)", "url"],
  ["countyZoningRetrievedAt", "County zoning retrieval date (required with zoning)", "datetime-local"],
];

export default function ExternalLandResearchIntake({ refresh, navigateToDeal }) {
  const [input, setInput] = useState({});
  const [review, setReview] = useState(null);
  const [saved, setSaved] = useState(null);
  const [appended, setAppended] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");

  async function perform(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (failure) { setError(failure?.message || "The operation was not confirmed. Review before retrying."); }
    finally { pending.current = false; setBusy(false); }
  }

  async function refreshList() {
    try { await refresh?.(); }
    catch { setError("Saved, but the list could not refresh. Reload before continuing."); }
  }

  return <details style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12, marginBottom: 16 }}>
    <summary>External property research → Vacant land</summary>
    <h3>Save as Research-only land lead</h3>
    <p>Volusia County, Florida. No seller contact is required. Public-record ownership is evidence only. Listing price is evidence only. No outreach is authorized. One exact official parcel match and county vacant residential classification are required before save.</p>
    <form onSubmit={(event) => { event.preventDefault(); perform(async () => {
      const { reviewExternalLandCandidate } = await import("../services/leadIntake/externalLandIntakeService");
      setReview(await reviewExternalLandCandidate(input));
    }); }}>
      <fieldset disabled={busy || Boolean(review)} style={{ border: 0, padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {fields.map(([key, label, type, required]) => <label key={key}>
            <span style={{ display: "block" }}>{label}</span>
            <input type={type} required={required} value={input[key] || ""}
              maxLength={key.includes("Url") ? 500 : 160}
              pattern={key === "parid" ? "[0-9]{7}" : undefined}
              inputMode={key === "parid" ? "numeric" : undefined}
              min={type === "number" ? "0" : undefined} step={type === "number" ? "any" : undefined}
              onChange={(event) => setInput((current) => ({ ...current, [key]: event.target.value }))} />
          </label>)}
        </div>
        <label style={{ display: "block", marginTop: 12 }}>Other listing claims / limitations (optional, 320 characters)
          <textarea maxLength={320} value={input.listingClaims || ""} onChange={(event) => setInput((current) => ({ ...current, listingClaims: event.target.value }))} />
        </label>
        <p>Record flood, wetlands, utilities, water/well, sewer/septic, and access statements as attributed claims. Missing information remains unknown. Official zoning entered here requires your review of the linked county source; the parcel lookup does not fetch zoning.</p>
        <button type="submit">Verify Official Parcel & Check Duplicates</button>
      </fieldset>
    </form>
    {review && <section aria-label="External land review">
      <h4>Review parcel and supporting evidence</h4>
      <p>Exact official PARID: {review.identity.authoritativeParcelId} · Volusia County · {review.verification.parcel.propertyUse.description}</p>
      <p>Official situs: {review.verification.parcel.situsAddress?.addressLine || "Not supplied by county"}. Listing location: {review.input?.location || "Not supplied"}.</p>
      <p>{review.existingDeal ? "Duplicate status: an active lead already exists for this parcel. It will be returned without overwriting its facts or scope." : "Duplicate status: no active lead found in this organization. Save rechecks through durable canonical admission."}</p>
      <p>Seller, phone, email, motivation, timeline, ARV, and repairs remain unknown. Verify buildability and feasibility before any acquisition action.</p>
      <ul>{review.commands.map((command, index) => <li key={index}>
        <strong>{command.fact}</strong> — {command.status} / {command.resolutionState}
        {" · "}{command.sourceName}{" · "}{command.retrievedAt}{" · "}
        <a href={command.sourceUrl} target="_blank" rel="noreferrer">Source</a>
        <div>{command.notes}</div>
      </li>)}</ul>
      {!saved && <button type="button" disabled={busy} onClick={() => perform(async () => {
        const { confirmExternalLandCandidate } = await import("../services/leadIntake/externalLandIntakeService");
        setSaved(await confirmExternalLandCandidate(review));
        await refreshList();
      })}>{review.existingDeal ? "Confirm Existing Lead" : "Confirm Save Research Lead"}</button>}
      {saved && <>
        <p role="status">{saved.status === "existing"
          ? appended ? "Existing lead retained; source history and reviewed supporting evidence are saved." : "Existing lead returned. No new deal created. Source history retained; confirm separately to append supporting evidence."
          : "Research-only land lead saved with supporting evidence."}</p>
        <button type="button" onClick={() => navigateToDeal?.(saved.deal.id)}>Open Saved Lead</button>
        {saved.status === "existing" && !appended && <button type="button" disabled={busy} onClick={() => perform(async () => {
          const { appendExternalLandEvidence } = await import("../services/leadIntake/externalLandIntakeService");
          const result = await appendExternalLandEvidence(review, saved.deal);
          if (!result.success) throw new Error(result.error?.message || "Evidence was not appended. Reload the existing lead before retrying.");
          setSaved({ ...saved, deal: result.data });
          setAppended(true);
          await refreshList();
        })}>Confirm Append Reviewed Evidence to Existing Lead</button>}
        {appended && <p role="status">Reviewed evidence appended. Canonical facts and operating scope were preserved.</p>}
      </>}
      <button type="button" disabled={busy} onClick={() => { setReview(null); setSaved(null); setAppended(false); setError(""); }}>Start New Review</button>
    </section>}
    {busy && <p role="status">Checking / saving reviewed research…</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
