import { useEffect, useMemo, useState } from "react";
import { analyzeOfferStrategy } from "../services/offers";
import { loadThreadMessages } from "../services/conversations";

function LevelCard({ label, value }) {
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

export default function OfferStrategy({
deal,
selectedPhone,
refreshKey,
}) {
const [messages, setMessages] = useState([]);

useEffect(() => {
if (!selectedPhone) {
  setMessages([]);
  return;
}

loadMessages();
}, [selectedPhone, refreshKey]);

async function loadMessages() {
const result = await loadThreadMessages(selectedPhone);

if (!result.success) {
  console.error("[OfferStrategy] Message load failed:", result.error);
  setMessages([]);
  return;
}

setMessages(result.data);
}

const strategy = useMemo(
() => analyzeOfferStrategy({ deal, messages }),
[deal, messages]
);

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
color: "#64748b",
fontSize: 13,
fontWeight: 700,
marginBottom: 4,
textTransform: "uppercase",
}}
>
Offer Strategy
</div>

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
marginTop: 12,
}}
>
<LevelCard
  label="Seller Leverage"
  value={strategy.sellerLeverage}
/>
<LevelCard
  label="Buyer Leverage"
  value={strategy.buyerLeverage}
/>
<LevelCard
  label="Negotiation Posture"
  value={strategy.posture}
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
{strategy.summary}
</div>

<div
style={{
display: "grid",
gap: 12,
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
marginTop: 14,
}}
>
<div>
  <strong>Key leverage factors</strong>
  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
    {strategy.factors.map((factor) => (
      <li key={factor}>{factor}</li>
    ))}
  </ul>
</div>

<div>
  <strong>Missing leverage data</strong>
  {strategy.missing.length === 0 ? (
    <p style={{ marginBottom: 0 }}>No major leverage gaps detected.</p>
  ) : (
    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
      {strategy.missing.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )}
</div>
</div>
</div>
);
}
