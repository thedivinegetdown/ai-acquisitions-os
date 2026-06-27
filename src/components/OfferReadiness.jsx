import { analyzeOfferReadiness } from "../services/offers";

export default function OfferReadiness({ deal }) {
const readiness = analyzeOfferReadiness(deal);

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
    Offer Readiness
  </div>

  <strong
    style={{
    color: "#0f172a",
    fontSize: 24,
    }}
  >
    {readiness.score}/100
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
  {readiness.status}
</span>
</div>

<div
style={{
display: "grid",
gap: 8,
gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
}}
>
{readiness.checklist.map((item) => (
  <div
    key={item.label}
    style={{
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    color: item.complete ? "#166534" : "#475569",
    padding: 10,
    }}
  >
    <strong>{item.complete ? "Complete" : "Missing"}</strong>
    <div
      style={{
      color: "#0f172a",
      marginTop: 4,
      }}
    >
      {item.label}
    </div>
  </div>
))}
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
<strong>Recommended next step:</strong>{" "}
{readiness.recommendedNextStep}
</div>
</div>
);
}
