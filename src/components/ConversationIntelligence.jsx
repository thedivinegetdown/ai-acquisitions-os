import { useEffect, useMemo, useState } from "react";
import { analyzeConversation } from "../services/conversationAnalysis";
import { loadThreadMessages } from "../services/conversations";

function SignalCard({ label, value }) {
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

function PhraseList({ title, items, emptyText }) {
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

export default function ConversationIntelligence({
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
  console.error("[ConversationIntelligence] Message load failed:", result.error);
  setMessages([]);
  return;
}

setMessages(result.data);
}

const analysis = useMemo(
() => analyzeConversation(messages),
[messages]
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
marginBottom: 12,
textTransform: "uppercase",
}}
>
Conversation Intelligence
</div>

{!analysis.hasData ? (
  <p>No conversation data available yet.</p>
) : (
  <>
    <div
      style={{
      display: "grid",
      gap: 10,
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      marginBottom: 12,
      }}
    >
      <SignalCard
        label="Seller Sentiment"
        value={analysis.sentiment}
      />
      <SignalCard
        label="Urgency Level"
        value={analysis.urgency}
      />
      <SignalCard
        label="Engagement Level"
        value={analysis.engagement}
      />
    </div>

    <div
      style={{
      display: "grid",
      gap: 12,
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      <PhraseList
        title="Detected seller intent"
        items={analysis.detectedIntent}
        emptyText="No clear intent detected."
      />
      <PhraseList
        title="Key phrases"
        items={analysis.keyPhrases}
        emptyText="No key phrases detected."
      />
      <PhraseList
        title="Red flags"
        items={analysis.redFlags}
        emptyText="No red flags detected."
      />
    </div>
  </>
)}

<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 10,
color: "#334155",
lineHeight: 1.5,
marginTop: 12,
padding: 12,
}}
>
<strong>Suggested communication tone:</strong>{" "}
{analysis.suggestedTone}
</div>
</div>
);
}
