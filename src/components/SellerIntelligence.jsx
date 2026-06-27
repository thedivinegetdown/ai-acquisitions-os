import { useEffect, useMemo, useState } from "react";
import { loadThreadMessages } from "../services/conversations";
import { formatSafeDate, toSafeDate } from "../utils/dates";

function getDaysSince(value) {
  const date = toSafeDate(value);

  if (!date) return null;

  const elapsed = Date.now() - date.getTime();
  return Math.floor(elapsed / (1000 * 60 * 60 * 24));
}

function buildAnalysis({ deal, messages }) {
const leadScore = Number(deal?.lead_score || 0);
const motivationScore = Number(
deal?.motivation_score ?? deal?.motivation ?? 0
);
const stage = deal?.stage || "New Lead";
const lastMessage = messages[messages.length - 1];
const lastContact = lastMessage?.created_at || null;
const daysSinceLastContact = getDaysSince(lastContact);
const inboundCount = messages.filter(
  (message) => message.direction !== "outbound"
).length;
const outboundCount = messages.filter(
  (message) => message.direction === "outbound"
).length;
const responseRate =
  outboundCount > 0
    ? `${Math.round((inboundCount / outboundCount) * 100)}%`
    : inboundCount > 0
      ? "100%"
      : "No data";

let sellerSentiment = "Neutral";
if (inboundCount > outboundCount && motivationScore >= 6) {
  sellerSentiment = "Positive";
} else if (outboundCount > inboundCount + 2) {
  sellerSentiment = "Negative";
}

let motivation = "Low";
if (leadScore >= 8 || motivationScore >= 8) {
  motivation = "High";
} else if (leadScore >= 5 || motivationScore >= 5) {
  motivation = "Medium";
}

let closingTimeline = "30+ days";
if (motivation === "High" && stage === "Offer Sent") {
  closingTimeline = "7-14 days";
} else if (motivation === "High" || stage === "Contacted") {
  closingTimeline = "14-30 days";
}

let nextAction = "Initial Contact";
if (stage === "Contacted") {
  nextAction = "Schedule Call";
} else if (stage === "Offer Sent") {
  nextAction = "Follow Up on Offer";
} else if (daysSinceLastContact !== null && daysSinceLastContact >= 3) {
  nextAction = "Follow Up";
}

  return {
    sellerSentiment,
    motivation,
    responseRate,
    lastContact: formatSafeDate(lastContact, "No contact yet"),
    closingTimeline,
    nextAction,
  };
}

function IntelligenceCard({ label, value }) {
return (
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 14,
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
{label}
</div>

<div
style={{
color: "#0f172a",
fontSize: 18,
fontWeight: 800,
}}
>
{value}
</div>
</div>
);
}

export default function SellerIntelligence({
deal,
selectedPhone,
refreshKey,
}) {
const [messages, setMessages] = useState([]);
const [analysisVersion, setAnalysisVersion] = useState(0);

useEffect(() => {
if (!selectedPhone) {
  setMessages([]);
  return;
}

loadMessages();
}, [selectedPhone, refreshKey, analysisVersion]);

async function loadMessages() {
const result = await loadThreadMessages(selectedPhone);

if (!result.success) {
  console.error("[SellerIntelligence] Message load failed:", result.error);
  setMessages([]);
  return;
}

setMessages(result.data);
}

const analysis = useMemo(
() => buildAnalysis({ deal, messages }),
[deal, messages]
);

return (
<aside
style={{
background: "#f8fafc",
border: "1px solid #dbe3ef",
borderRadius: 14,
padding: 18,
alignSelf: "start",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
marginBottom: 14,
}}
>
<h3
style={{
margin: 0,
color: "#0f172a",
}}
>
Seller Intelligence
</h3>
</div>

<div
style={{
display: "grid",
gap: 10,
}}
>
<IntelligenceCard
  label="Seller Sentiment"
  value={analysis.sellerSentiment}
/>
<IntelligenceCard
  label="Motivation"
  value={analysis.motivation}
/>
<IntelligenceCard
  label="Response Rate"
  value={analysis.responseRate}
/>
<IntelligenceCard
  label="Last Contact"
  value={analysis.lastContact}
/>
<IntelligenceCard
  label="Estimated Closing Timeline"
  value={analysis.closingTimeline}
/>
<IntelligenceCard
  label="AI Suggested Next Action"
  value={analysis.nextAction}
/>
</div>

<button
type="button"
onClick={() => setAnalysisVersion((current) => current + 1)}
style={{
width: "100%",
marginTop: 14,
padding: "10px 14px",
border: "1px solid #0f172a",
borderRadius: 8,
background: "#0f172a",
color: "#ffffff",
cursor: "pointer",
fontWeight: 700,
}}
>
Generate AI Analysis
</button>
</aside>
);
}
