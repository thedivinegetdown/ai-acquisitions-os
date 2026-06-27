import { useEffect, useMemo, useState } from "react";
import { planFollowUp } from "../services/followUpPlanner";
import { loadThreadMessages } from "../services/conversations";

const URGENCY_STYLES = {
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

function DetailCard({ label, value }) {
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

export default function FollowUpPlanner({
deal,
selectedPhone,
refreshKey,
}) {
const [messages, setMessages] = useState([]);
const [draftMessage, setDraftMessage] = useState("");
const [copyStatus, setCopyStatus] = useState("");

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
  console.error("[FollowUpPlanner] Message load failed:", result.error);
  setMessages([]);
  return;
}

setMessages(result.data);
}

const plan = useMemo(
() => planFollowUp({ deal, messages }),
[deal, messages]
);
const urgencyStyle = URGENCY_STYLES[plan.urgency];

useEffect(() => {
setDraftMessage(plan.suggestedMessage);
setCopyStatus("");
}, [plan.suggestedMessage]);

async function copyMessage() {
setCopyStatus("");

try {
  await navigator.clipboard.writeText(draftMessage);
  setCopyStatus("Copied");
} catch (error) {
  console.error("[FollowUpPlanner] Copy failed:", error);
  setCopyStatus("Copy failed");
}
}

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
<div
  style={{
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  }}
>
  Follow-Up Planner
</div>

<span
  style={{
  background: urgencyStyle.background,
  border: `1px solid ${urgencyStyle.border}`,
  borderRadius: 999,
  color: urgencyStyle.color,
  fontSize: 13,
  fontWeight: 800,
  padding: "7px 12px",
  }}
>
  {plan.urgency}
</span>
</div>

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
marginBottom: 12,
}}
>
<DetailCard
  label="Follow-up Time"
  value={plan.followUpTime}
/>
<DetailCard
  label="Channel"
  value={plan.channel}
/>
<DetailCard
  label="Offer Readiness"
  value={plan.readinessStatus}
/>
</div>

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
marginBottom: 6,
textTransform: "uppercase",
}}
>
Suggested follow-up message
</div>

<textarea
value={draftMessage}
onChange={(event) => setDraftMessage(event.target.value)}
rows="4"
style={{
width: "100%",
border: "1px solid #d1d5db",
borderRadius: 8,
padding: 10,
resize: "vertical",
}}
/>

<button
type="button"
onClick={copyMessage}
style={{
marginTop: 10,
padding: "8px 12px",
border: "1px solid #0f172a",
borderRadius: 8,
background: "#0f172a",
color: "#ffffff",
cursor: "pointer",
fontWeight: 700,
}}
>
Copy Message
</button>

{copyStatus && (
  <span
    style={{
    color: copyStatus === "Copied" ? "#166534" : "#b91c1c",
    marginLeft: 10,
    }}
  >
    {copyStatus}
  </span>
)}
</div>

<div
style={{
display: "grid",
gap: 10,
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
marginTop: 12,
}}
>
<div
  style={{
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  }}
>
  <strong>Reasoning</strong>
  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
    {plan.reasoning.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
</div>

<div
  style={{
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  }}
>
  <strong>Missing data</strong>
  {plan.missingData.length === 0 ? (
    <p style={{ marginBottom: 0 }}>No major missing data.</p>
  ) : (
    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
      {plan.missingData.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )}
</div>
</div>
</div>
);
}
