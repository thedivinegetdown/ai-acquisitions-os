import { useEffect, useMemo, useState } from "react";
import { prioritizeLead } from "../services/leadPriority";
import { loadThreadMessages } from "../services/conversations";

const LABEL_STYLES = {
Low: {
background: "#f1f5f9",
border: "#e2e8f0",
color: "#475569",
},
Medium: {
background: "#fef3c7",
border: "#fde68a",
color: "#92400e",
},
High: {
background: "#dbeafe",
border: "#bfdbfe",
color: "#1d4ed8",
},
Critical: {
background: "#fee2e2",
border: "#fecaca",
color: "#991b1b",
},
};

function DetailList({ title, items, emptyText }) {
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
{items.length === 0 ? (
  <p style={{ marginBottom: 0 }}>{emptyText}</p>
) : (
  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
)}
</div>
);
}

export default function LeadPriorityPanel({
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
  console.error("[LeadPriorityPanel] Message load failed:", result.error);
  setMessages([]);
  return;
}

setMessages(result.data);
}

const priority = useMemo(
() => prioritizeLead({ deal, messages }),
[deal, messages]
);
const labelStyle = LABEL_STYLES[priority.priorityLabel];

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
    Lead Priority
  </div>
  <strong
    style={{
    color: "#0f172a",
    fontSize: 24,
    }}
  >
    {priority.priorityScore}/100
  </strong>
</div>

<span
  style={{
  background: labelStyle.background,
  border: `1px solid ${labelStyle.border}`,
  borderRadius: 999,
  color: labelStyle.color,
  fontSize: 13,
  fontWeight: 800,
  padding: "7px 12px",
  }}
>
  {priority.priorityLabel}
</span>
</div>

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
}}
>
<div
  style={{
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  color: "#334155",
  lineHeight: 1.5,
  padding: 12,
  }}
>
  <strong>Why this lead matters</strong>
  <p style={{ marginBottom: 0 }}>{priority.whyThisLeadMatters}</p>
</div>

<div
  style={{
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  color: "#334155",
  lineHeight: 1.5,
  padding: 12,
  }}
>
  <strong>Suggested action</strong>
  <p style={{ marginBottom: 0 }}>{priority.suggestedAction}</p>
</div>
</div>

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
marginTop: 10,
}}
>
<DetailList
  title="Priority factors"
  items={priority.factors}
  emptyText="No priority factors detected."
/>
<DetailList
  title="Missing data"
  items={priority.missingData}
  emptyText="No major missing data."
/>
</div>
</div>
);
}
