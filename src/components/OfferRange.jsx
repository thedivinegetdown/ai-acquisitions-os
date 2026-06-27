import { analyzeOfferRange } from "../services/offers";
import { formatNonNegativeUsd } from "../utils/currency";

function Metric({ label, value }) {
return (
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 10,
padding: 12,
}}
>
<div
style={{
color: "#64748b",
fontSize: 12,
fontWeight: 700,
marginBottom: 4,
textTransform: "uppercase",
}}
>
{label}
</div>
<strong>{value}</strong>
</div>
);
}

export default function OfferRange({ deal }) {
const range = analyzeOfferRange(deal);

return (
<div
style={{
background: "#f8fafc",
border: "1px solid #dbe3ef",
borderRadius: 14,
padding: 18,
marginBottom: 18,
boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "flex-start",
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
    marginBottom: 4,
    textTransform: "uppercase",
    }}
  >
    Offer Range
  </div>
  <strong
    style={{
    color: "#0f172a",
    fontSize: 22,
    }}
  >
    Suggested Acquisition Range
  </strong>
</div>

<span
  style={{
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
  padding: "7px 12px",
  }}
>
  {range.confidence} Confidence
</span>
</div>

{range.warning && (
  <div
    style={{
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    color: "#9a3412",
    marginBottom: 12,
    padding: 12,
    }}
  >
    {range.warning}
  </div>
)}

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
}}
>
<Metric
  label="Conservative Offer"
  value={range.offers ? formatNonNegativeUsd(range.offers.conservative) : "ARV needed"}
/>
<Metric
  label="Target Offer"
  value={range.offers ? formatNonNegativeUsd(range.offers.target) : "ARV needed"}
/>
<Metric
  label="Max Offer"
  value={range.offers ? formatNonNegativeUsd(range.offers.max) : "ARV needed"}
/>
</div>

<div
style={{
display: "grid",
gap: 8,
gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
marginTop: 12,
}}
>
<Metric
  label="ARV"
  value={range.arv ? formatNonNegativeUsd(range.arv) : "Missing"}
/>
<Metric
  label="Repairs"
  value={range.repairs ? formatNonNegativeUsd(range.repairs) : "$0 assumed"}
/>
<Metric
  label="Asking Price"
  value={range.askingPrice ? formatNonNegativeUsd(range.askingPrice) : "Missing"}
/>
<Metric
  label="Rent Estimate"
  value={range.rentEstimate ? formatNonNegativeUsd(range.rentEstimate) : "Missing"}
/>
<Metric
  label="Mortgage Balance"
  value={range.mortgageBalance ? formatNonNegativeUsd(range.mortgageBalance) : "Missing"}
/>
<Metric
  label="Motivation"
  value={range.motivation ?? "Missing"}
/>
</div>

<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 10,
color: "#334155",
lineHeight: 1.5,
marginTop: 14,
padding: 12,
}}
>
This is a preliminary acquisition range, not a final offer.
</div>
</div>
);
}
