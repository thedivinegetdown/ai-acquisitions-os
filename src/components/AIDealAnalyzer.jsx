import { useMemo } from "react";
import { analyzeDeal } from "../services/dealAnalysis";

const INDICATOR_COLORS = {
Excellent: {
background: "#dcfce7",
border: "#bbf7d0",
color: "#166534",
},
Good: {
background: "#dbeafe",
border: "#bfdbfe",
color: "#1d4ed8",
},
Fair: {
background: "#fef3c7",
border: "#fde68a",
color: "#92400e",
},
Poor: {
background: "#fee2e2",
border: "#fecaca",
color: "#991b1b",
},
};

function InsightList({ title, items }) {
return (
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 10,
padding: 12,
}}
>
<strong>{title}</strong>
<ul
style={{
marginBottom: 0,
paddingLeft: 20,
}}
>
{items.map((item) => (
  <li key={item}>{item}</li>
))}
</ul>
</div>
);
}

export default function AIDealAnalyzer({ deal }) {
const analysis = useMemo(() => analyzeDeal(deal), [deal]);
const indicatorStyle = INDICATOR_COLORS[analysis.indicator];

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
    AI Deal Analyzer
  </div>
  <strong
    style={{
    color: "#0f172a",
    fontSize: 24,
    }}
  >
    {analysis.score}/100
  </strong>
</div>

<div
  style={{
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  }}
>
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
    Grade {analysis.grade}
  </span>

  <span
    style={{
    background: indicatorStyle.background,
    border: `1px solid ${indicatorStyle.border}`,
    borderRadius: 999,
    color: indicatorStyle.color,
    fontSize: 13,
    fontWeight: 800,
    padding: "7px 12px",
    }}
  >
    {analysis.indicator}
  </span>
</div>
</div>

<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 10,
color: "#334155",
lineHeight: 1.5,
marginBottom: 14,
padding: 12,
}}
>
{analysis.summary}
</div>

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
}}
>
<InsightList title="Strengths" items={analysis.strengths} />
<InsightList title="Weaknesses" items={analysis.weaknesses} />
<InsightList title="Risks" items={analysis.risks} />
<InsightList title="Opportunities" items={analysis.opportunities} />
<InsightList
  title="Missing Information"
  items={
    analysis.missingInformation.length
      ? analysis.missingInformation
      : ["No major missing information detected."]
  }
/>
</div>
</div>
);
}
