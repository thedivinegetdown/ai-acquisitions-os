import { useMemo, useState } from "react";
import { Button, Input, StatusBadge } from "../design-system";
import { evaluateResidentialStrategyPreview } from "../services/asset-strategy";
import { updateDeal } from "../services/repositories";
import { formatUsd } from "../utils/currency";
import { DEAL_FIELD_ALIASES, getDealAlias } from "../utils/dealFields";
import { parseSafeNumber } from "../utils/numbers";

function initialValue(deal, alias) {
  const value = getDealAlias(deal, alias);
  return value === null || value === undefined ? "" : String(value);
}

function buildPreviewDeal(deal, values) {
  const preview = { ...deal };
  Object.entries(values).forEach(([alias, value]) => {
    (DEAL_FIELD_ALIASES[alias] || [alias]).forEach((field) => {
      preview[field] = value;
    });
  });
  return preview;
}

export default function DealAnalyzer({ deal, refresh }) {
  const [arv, setArv] = useState(() => initialValue(deal, "arv"));
  const [repairs, setRepairs] = useState(() => initialValue(deal, "repairs"));
  const [price, setPrice] = useState(() => initialValue(deal, "askingPrice"));
  const [rent, setRent] = useState(() => initialValue(deal, "rent"));
  const [evaluatedTimestamp] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const preview = useMemo(
    () =>
      evaluateResidentialStrategyPreview({
        deal: buildPreviewDeal(deal, {
          arv,
          askingPrice: price,
          rent,
          repairs,
        }),
        evaluatedTimestamp,
      }),
    [arv, deal, evaluatedTimestamp, price, rent, repairs]
  );
  const underwriting = preview.underwriting;
  const evaluated = underwriting?.evaluationState === "evaluated";

  async function save() {
    const values = { arv, price, rent, repairs };
    const changes = Object.fromEntries(
      Object.entries(values)
        .map(([key, value]) => [key, parseSafeNumber(value)])
        .filter(([, value]) => value !== null)
    );
    if (!Object.keys(changes).length) {
      setSaveStatus("Enter at least one valid numeric analysis input before saving.");
      return;
    }

    setSaving(true);
    setSaveStatus("");
    const result = await updateDeal(deal.id, changes);
    setSaving(false);

    if (!result.success) {
      console.error(result.error);
      setSaveStatus("Analysis inputs could not be saved. Review the values and try again.");
      return;
    }

    setSaveStatus("Analysis inputs saved.");
    refresh?.();
  }

  return (
    <section aria-labelledby="deal-analyzer-title" className="residential-analyzer">
      <div className="residential-analyzer__header">
        <h3 id="deal-analyzer-title">Residential analysis inputs</h3>
        <StatusBadge status={evaluated ? "info" : "warning"}>
          {evaluated ? "Preview evaluated" : "Missing required facts"}
        </StatusBadge>
      </div>

      <div className="residential-analyzer__inputs">
        <Input inputMode="decimal" label="After-repair value" onChange={(event) => setArv(event.target.value)} value={arv} />
        <Input inputMode="decimal" label="Repair estimate" onChange={(event) => setRepairs(event.target.value)} value={repairs} />
        <Input inputMode="decimal" label="Asking price" onChange={(event) => setPrice(event.target.value)} value={price} />
        <Input inputMode="decimal" label="Monthly rent, optional" onChange={(event) => setRent(event.target.value)} value={rent} />
      </div>

      {evaluated ? (
        <dl aria-label="Residential analysis preview" className="residential-analyzer__results">
          <div><dt>Acquisition ceiling</dt><dd>{formatUsd(underwriting.acquisitionCeiling)}</dd></div>
          <div><dt>Ceiling spread</dt><dd>{formatUsd(underwriting.ceilingSpread)}</dd></div>
          <div><dt>Wholesale target</dt><dd>{formatUsd(underwriting.wholesaleTarget)}</dd></div>
          <div><dt>Projected flip gross margin</dt><dd>{formatUsd(underwriting.projectedFlipGrossMargin)}</dd></div>
        </dl>
      ) : (
        <p className="residential-analyzer__notice">
          Enter a positive ARV and asking price plus an explicit repair estimate. Missing values are not treated as zero.
        </p>
      )}

      <Button disabled={saving} onClick={save}>
        {saving ? "Saving..." : "Save Analysis Inputs"}
      </Button>
      {saveStatus ? <p aria-live="polite" className="residential-analyzer__status">{saveStatus}</p> : null}
    </section>
  );
}
