import { useEffect, useMemo, useState } from "react";
import { loadThreadMessages } from "../services/conversations";

function getHoursSince(value) {
if (!value) return null;

const elapsed = Date.now() - new Date(value).getTime();
return elapsed / (1000 * 60 * 60);
}

function buildRecommendation({ deal, messages }) {
const stage = deal?.stage || "New Lead";
const leadScore = Number(deal?.lead_score || 0);
const motivationScore = Number(
deal?.motivation_score ?? deal?.motivation ?? 0
);
const lastInbound = [...messages]
.reverse()
.find((message) => message.direction !== "outbound");
const lastOutbound = [...messages]
.reverse()
.find((message) => message.direction === "outbound");
const lastContact = messages[messages.length - 1];
const lastInboundHours = getHoursSince(lastInbound?.created_at);
const lastOutboundHours = getHoursSince(lastOutbound?.created_at);
const lastContactHours = getHoursSince(lastContact?.created_at);
const highIntent = leadScore >= 8 || motivationScore >= 8;

if (stage === "Closed") {
  return {
    action: "No Action Needed",
    priority: "Low",
    reason: "This seller is already marked closed.",
  };
}

if (stage === "Dead Lead") {
  return {
    action: "Mark as Dead Lead",
    priority: "Low",
    reason: "This lead is already showing as inactive in the pipeline.",
  };
}

if (lastInboundHours !== null && lastInboundHours <= 1 && highIntent) {
  return {
    action: "Call Seller",
    priority: "High",
    reason:
      "Seller responded within the last hour and has a high motivation score.",
  };
}

if (stage === "Offer Sent") {
  return {
    action: "Send Purchase Agreement",
    priority: highIntent ? "High" : "Medium",
    reason: "An offer has already been sent, so the next step is to move toward agreement.",
  };
}

if (stage === "Contacted" && highIntent) {
  return {
    action: "Schedule Appointment",
    priority: "High",
    reason: "The seller has been contacted and the lead indicators are strong.",
  };
}

if (stage === "Contacted") {
  return {
    action: "Schedule Appointment",
    priority: "Medium",
    reason: "The lead is contacted and ready for a qualification call or appointment.",
  };
}

if (stage === "Under Contract") {
  return {
    action: "No Action Needed",
    priority: "Low",
    reason: "This lead is already under contract.",
  };
}

if (highIntent && messages.length > 0) {
  return {
    action: "Generate Cash Offer",
    priority: "High",
    reason: "High lead or motivation score indicates this seller may be ready for an offer.",
  };
}

if (lastOutboundHours !== null && lastOutboundHours >= 24 && lastOutboundHours < 72) {
  return {
    action: "Follow Up Tomorrow",
    priority: "Medium",
    reason: "There has been no seller reply since the last outbound message.",
  };
}

if (lastOutboundHours !== null && lastOutboundHours >= 72) {
  return {
    action: "Send Follow-Up SMS",
    priority: "Medium",
    reason: "The last outbound message is several days old and needs a follow-up.",
  };
}

if (lastContactHours !== null && lastContactHours >= 168) {
  return {
    action: "Follow Up Next Week",
    priority: "Low",
    reason: "The conversation has been quiet for over a week.",
  };
}

if (messages.length === 0 || stage === "New Lead") {
  return {
    action: "Send Follow-Up SMS",
    priority: "Medium",
    reason: "This is a new lead and needs initial outreach.",
  };
}

return {
action: "No Action Needed",
priority: "Low",
reason: "Recent activity does not indicate an urgent next step.",
};
}

export default function NextBestAction({
deal,
selectedPhone,
refreshKey,
onFocusReply,
}) {
const [messages, setMessages] = useState([]);
const [statusMessage, setStatusMessage] = useState("");

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
  console.error("[NextBestAction] Message load failed:", result.error);
  setMessages([]);
  return;
}

setMessages(result.data);
}

const recommendation = useMemo(
() => buildRecommendation({ deal, messages }),
[deal, messages]
);

function executeAction() {
setStatusMessage("");

if (recommendation.action === "Call Seller") {
  window.location.href = `tel:${selectedPhone}`;
  return;
}

if (recommendation.action === "Send Follow-Up SMS") {
  onFocusReply?.();
  return;
}

setStatusMessage("Coming Soon");
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
color: "#64748b",
fontSize: 13,
fontWeight: 700,
marginBottom: 4,
textTransform: "uppercase",
}}
>
Next Best Action
</div>

<div
style={{
display: "grid",
gap: 12,
gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
marginTop: 12,
}}
>
<div>
  <div style={{ color: "#64748b", fontSize: 12 }}>
    Recommended Action
  </div>
  <strong>{recommendation.action}</strong>
</div>

<div>
  <div style={{ color: "#64748b", fontSize: 12 }}>
    Priority
  </div>
  <strong>{recommendation.priority}</strong>
</div>
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
{recommendation.reason}
</div>

<button
type="button"
onClick={executeAction}
style={{
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
Execute Action
</button>

{statusMessage && (
  <span
    style={{
    color: "#64748b",
    marginLeft: 10,
    }}
  >
    {statusMessage}
  </span>
)}
</div>
);
}
