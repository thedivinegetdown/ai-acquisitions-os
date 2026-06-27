import { lazy, Suspense, useEffect, useRef, useState } from "react";
import AIDealAnalyzer from "./AIDealAnalyzer";
import ConversationIntelligence from "./ConversationIntelligence";
import ActivityTimeline from "./ActivityTimeline";
import FollowUpPlanner from "./FollowUpPlanner";
import LeadPriorityPanel from "./LeadPriorityPanel";
import NegotiationScript from "./NegotiationScript";
import OfferBuilder from "./OfferBuilder";
import NextBestAction from "./NextBestAction";
import OfferRange from "./OfferRange";
import OfferReadiness from "./OfferReadiness";
import OfferStrategy from "./OfferStrategy";
import SellerIntelligence from "./SellerIntelligence";
import SellerTasks from "./SellerTasks";
import LazyPanelFallback from "./LazyPanelFallback";
import { logger } from "../services/logging";
import {
insertOutboundMessageLog,
loadConversationThread,
} from "../services/conversations";
import { sendOutboundSms } from "../services/sms";

const AIIntelligenceDashboard = lazy(() => import("./AIIntelligenceDashboard"));
const AutomationSequencesPanel = lazy(() => import("./AutomationSequencesPanel"));
const BuyerDispositionsPanel = lazy(() => import("./BuyerDispositionsPanel"));
const PropertyIntelligencePanel = lazy(() => import("./PropertyIntelligencePanel"));
const TransactionManagementPanel = lazy(() => import("./TransactionManagementPanel"));
const CopilotPanel = lazy(() =>
import("../features/copilot").then((module) => ({ default: module.CopilotPanel }))
);
const CommunicationsHubPanel = lazy(() =>
import("../features/communications").then((module) => ({
  default: module.CommunicationsHubPanel,
}))
);
const WorkflowDashboardPanel = lazy(() =>
import("../features/workflows").then((module) => ({
  default: module.WorkflowDashboardPanel,
}))
);

export default function ConversationThread({ selectedPhone }) {
const [deal, setDeal] = useState(null);
const [conversation, setConversation] = useState(null);
const [dealLoading, setDealLoading] = useState(false);
const [reply, setReply] = useState("");
const [sending, setSending] = useState(false);
const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
const [copyStatus, setCopyStatus] = useState("");
const replyInputRef = useRef(null);
const conversationPanelRef = useRef(null);
const nextBestActionRef = useRef(null);
const aiDashboardRef = useRef(null);

useEffect(() => {
logger.debug("[ConversationThread] selectedPhone changed", { selectedPhone });

if (!selectedPhone) {
  setDeal(null);
  setConversation(null);
  setReply("");
  return;
}

loadDeal();
}, [selectedPhone]);

async function loadDeal() {
setDealLoading(true);
logger.debug("[ConversationThread] Loading deal", { selectedPhone });

const result = await loadConversationThread(selectedPhone);

if (!result.success) {
  logger.error("[ConversationThread] Deal load failed", result.error);
  setDeal(null);
  setDealLoading(false);
  return;
}

setDeal(result.data.deal || null);
setConversation(result.data.conversation || null);
setDealLoading(false);
}

async function sendReply() {
const trimmedReply = reply.trim();

logger.debug("[ConversationThread] sendReply clicked", {
  selectedPhone,
  hasReply: !!trimmedReply,
  sending,
});

if (!selectedPhone || !trimmedReply || sending) {
  logger.warn("[ConversationThread] Send blocked", {
    selectedPhone,
    hasReply: !!trimmedReply,
    sending,
  });
  return;
}

setSending(true);

try {
  logger.info("[ConversationThread] Sending SMS", {
    to: selectedPhone,
    messageLength: trimmedReply.length,
  });

  const sendResult = await sendOutboundSms({
    to: selectedPhone,
    message: trimmedReply,
  });

  logger.debug("[ConversationThread] send-sms response", {
    success: sendResult.success,
    result: sendResult.success ? sendResult.data : sendResult.error,
  });

  if (!sendResult.success) {
    throw new Error(sendResult.error.message || "Could not send SMS");
  }

  logger.debug("[ConversationThread] Inserting outbound message log");

  const logResult = await insertOutboundMessageLog({
    phone: selectedPhone,
    message: trimmedReply,
  });

  if (!logResult.success) {
    logger.error("[ConversationThread] Outbound log insert failed", logResult.error);
    throw new Error(logResult.error.message || "Could not log outbound message");
  }

  logger.info("[ConversationThread] Outbound log inserted successfully");
  setReply("");
  setTimelineRefreshKey((current) => current + 1);
} catch (error) {
  logger.error("[ConversationThread] Send failed", error);
} finally {
  setSending(false);
  logger.debug("[ConversationThread] Send flow complete");
}
}

function focusReplyBox() {
replyInputRef.current?.focus();
}

function copySellerPhone() {
const phone = deal?.phone || selectedPhone;
if (!phone || !navigator.clipboard) return;

navigator.clipboard.writeText(phone).then(
() => setCopyStatus("Copied"),
() => setCopyStatus("Copy failed")
);
}

function scrollToRef(ref) {
if (ref?.current) {
  ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
}
}

function openConversation() {
if (conversation?.messages?.length) {
  scrollToRef(conversationPanelRef);
  focusReplyBox();
}
}

function showNextBestAction() {
scrollToRef(nextBestActionRef);
}

function showAIRecommendation() {
scrollToRef(aiDashboardRef);
}

const sellerPhone = deal?.phone || selectedPhone;
const sellerPhoneLink = sellerPhone
? `tel:${sellerPhone.replace(/[^+\d]/g, "")}`
: "";
const hasConversation = Boolean(conversation?.messages?.length);

if (!selectedPhone) {
return <p>Select a conversation</p>;
}

return (
<div
id="seller-workspace"
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
gap: 18,
alignItems: "start",
width: "100%",
minWidth: 0,
}}
>
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 20,
minWidth: 0,
}}
>
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
gap: 16,
alignItems: "flex-start",
flexWrap: "wrap",
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
    Seller Workspace
  </div>

  <h2
    style={{
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
    wordBreak: "break-word",
    }}
  >
    {deal?.property_address || selectedPhone}
  </h2>
</div>

<div
  style={{
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    marginTop: 14,
  }}
>
  <button
    type="button"
    onClick={copySellerPhone}
    disabled={!sellerPhone}
    style={{
      padding: "10px 12px",
      border: "1px solid #0f172a",
      borderRadius: 8,
      background: sellerPhone ? "#0f172a" : "#e5e7eb",
      color: sellerPhone ? "#ffffff" : "#64748b",
      cursor: sellerPhone ? "pointer" : "not-allowed",
      fontWeight: 700,
      width: "100%",
    }}
  >
    {sellerPhone ? "Copy Seller Phone" : "No Phone Available"}
  </button>

  <a
    href={sellerPhone ? sellerPhoneLink : undefined}
    style={{
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "10px 12px",
      border: "1px solid #0f172a",
      borderRadius: 8,
      background: sellerPhone ? "#0f172a" : "#e5e7eb",
      color: sellerPhone ? "#ffffff" : "#64748b",
      cursor: sellerPhone ? "pointer" : "not-allowed",
      fontWeight: 700,
      textDecoration: "none",
      width: "100%",
      pointerEvents: sellerPhone ? "auto" : "none",
    }}
  >
    {sellerPhone ? "Call Seller" : "Call Disabled"}
  </a>

  <button
    type="button"
    onClick={focusReplyBox}
    style={{
      padding: "10px 12px",
      border: "1px solid #0f172a",
      borderRadius: 8,
      background: "#ffffff",
      color: "#0f172a",
      cursor: "pointer",
      fontWeight: 700,
      width: "100%",
    }}
  >
    Text Seller
  </button>

  <button
    type="button"
    onClick={openConversation}
    disabled={!hasConversation}
    style={{
      padding: "10px 12px",
      border: "1px solid #0f172a",
      borderRadius: 8,
      background: hasConversation ? "#0f172a" : "#e5e7eb",
      color: hasConversation ? "#ffffff" : "#64748b",
      cursor: hasConversation ? "pointer" : "not-allowed",
      fontWeight: 700,
      width: "100%",
    }}
  >
    {hasConversation ? "Open Conversation" : "No Conversation"}
  </button>

  <button
    type="button"
    onClick={showNextBestAction}
    style={{
      padding: "10px 12px",
      border: "1px solid #0f172a",
      borderRadius: 8,
      background: "#ffffff",
      color: "#0f172a",
      cursor: "pointer",
      fontWeight: 700,
      width: "100%",
    }}
  >
    View Next Best Action
  </button>

  <button
    type="button"
    onClick={showAIRecommendation}
    style={{
      padding: "10px 12px",
      border: "1px solid #0f172a",
      borderRadius: 8,
      background: "#ffffff",
      color: "#0f172a",
      cursor: "pointer",
      fontWeight: 700,
      width: "100%",
    }}
  >
    View AI Recommendation
  </button>
</div>

{copyStatus ? (
  <div
    style={{
      marginTop: 10,
      color: copyStatus === "Copied" ? "#166534" : "#b91c1c",
    }}
  >
    {copyStatus}
  </div>
) : null}

{!sellerPhone ? (
  <p style={{ color: "#64748b", marginTop: 10 }}>
    Seller phone is unavailable. Call and copy shortcuts are disabled.
  </p>
) : null}

{!hasConversation ? (
  <p style={{ color: "#64748b", marginTop: 10 }}>
    No conversation yet. Use the reply box to start the thread.
  </p>
) : null}

<div
  style={{
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  padding: "7px 12px",
  }}
>
  {deal?.stage || "No Stage"}
</div>
</div>

{dealLoading ? (
  <p>Loading deal...</p>
) : !deal ? (
  <p
    style={{
    color: "#475569",
    marginBottom: 0,
    }}
  >
    No deal is linked to this phone number.
  </p>
) : (
  <div
    style={{
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    marginTop: 16,
    }}
  >
    {deal.property_address && (
      <div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Property Address
        </div>
        <strong>{deal.property_address}</strong>
      </div>
    )}

    {deal.owner_name && (
      <div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Owner Name
        </div>
        <strong>{deal.owner_name}</strong>
      </div>
    )}

    <div>
      <div style={{ color: "#64748b", fontSize: 12 }}>
        Phone Number
      </div>
      <strong>{deal.phone || selectedPhone}</strong>
    </div>

    {deal.lead_score !== null && deal.lead_score !== undefined && (
      <div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Lead Score
        </div>
        <strong>{deal.lead_score}</strong>
      </div>
    )}

    {(deal.motivation_score !== null &&
      deal.motivation_score !== undefined) ||
    (deal.motivation !== null &&
      deal.motivation !== undefined) ? (
      <div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Motivation Score
        </div>
        <strong>{deal.motivation_score ?? deal.motivation}</strong>
      </div>
    ) : null}

    {deal.stage && (
      <div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Pipeline Stage
        </div>
        <strong>{deal.stage}</strong>
      </div>
    )}

    {deal.source && (
      <div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Lead Source
        </div>
        <strong>{deal.source}</strong>
      </div>
    )}
  </div>
)}
</div>

<div ref={nextBestActionRef} id="next-best-action">
  <NextBestAction
    deal={deal}
    selectedPhone={selectedPhone}
    refreshKey={timelineRefreshKey}
    onFocusReply={focusReplyBox}
  />
</div>

<SellerTasks
  deal={deal}
  selectedPhone={selectedPhone}
/>

<div ref={aiDashboardRef} id="ai-intelligence">
  <Suspense fallback={<LazyPanelFallback label="Loading AI copilot..." />}>
    <CopilotPanel
      deal={deal}
      selectedPhone={selectedPhone}
      refreshKey={timelineRefreshKey}
    />
  </Suspense>
</div>

<Suspense fallback={<LazyPanelFallback label="Loading workflow engine..." />}>
  <WorkflowDashboardPanel
    deal={deal}
    selectedPhone={selectedPhone}
    refreshKey={timelineRefreshKey}
  />
</Suspense>

<Suspense fallback={<LazyPanelFallback label="Loading communications hub..." />}>
  <CommunicationsHubPanel
    deal={deal}
    selectedPhone={selectedPhone}
    refreshKey={timelineRefreshKey}
    onSent={() => setTimelineRefreshKey((current) => current + 1)}
  />
</Suspense>

<Suspense fallback={<LazyPanelFallback label="Loading automation planner..." />}>
  <AutomationSequencesPanel
    deal={deal}
    selectedPhone={selectedPhone}
    refreshKey={timelineRefreshKey}
  />
</Suspense>

<Suspense fallback={<LazyPanelFallback label="Loading AI intelligence..." />}>
  <AIIntelligenceDashboard
    deal={deal}
    selectedPhone={selectedPhone}
    refreshKey={timelineRefreshKey}
  />
</Suspense>

<Suspense fallback={<LazyPanelFallback label="Loading property intelligence..." />}>
  <PropertyIntelligencePanel deal={deal} />
</Suspense>

<OfferReadiness deal={deal} />

<OfferRange deal={deal} />

<OfferStrategy
  deal={deal}
  selectedPhone={selectedPhone}
  refreshKey={timelineRefreshKey}
/>

<OfferBuilder deal={deal} />

<Suspense fallback={<LazyPanelFallback label="Loading buyer dispositions..." />}>
  <BuyerDispositionsPanel deal={deal} />
</Suspense>

<Suspense fallback={<LazyPanelFallback label="Loading transaction management..." />}>
  <TransactionManagementPanel deal={deal} />
</Suspense>

<NegotiationScript deal={deal} />

<AIDealAnalyzer deal={deal} />

<LeadPriorityPanel
  deal={deal}
  selectedPhone={selectedPhone}
  refreshKey={timelineRefreshKey}
/>

<FollowUpPlanner
  deal={deal}
  selectedPhone={selectedPhone}
  refreshKey={timelineRefreshKey}
/>

<ConversationIntelligence
  selectedPhone={selectedPhone}
  refreshKey={timelineRefreshKey}
/>

<ActivityTimeline
  selectedPhone={selectedPhone}
  refreshKey={timelineRefreshKey}
/>

<div
ref={conversationPanelRef}
style={{
borderTop: "1px solid #e5e7eb",
marginTop: 16,
paddingTop: 16,
}}
>
<textarea
          ref={replyInputRef}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Type a reply"
          aria-label="Reply message"
          style={{
            padding: 10,
            resize: "vertical",
          }}
        />

        <button
type="button"
onClick={sendReply}
disabled={sending || !reply.trim()}
style={{
marginTop: 10,
padding: "10px 14px",
border: "1px solid #0f172a",
borderRadius: 8,
background: sending || !reply.trim() ? "#e5e7eb" : "#0f172a",
color: sending || !reply.trim() ? "#64748b" : "#ffffff",
cursor: sending || !reply.trim() ? "not-allowed" : "pointer",
}}
>
{sending ? "Sending..." : "Send SMS"}
</button>
</div>
</div>

<SellerIntelligence
  deal={deal}
  selectedPhone={selectedPhone}
  refreshKey={timelineRefreshKey}
/>
</div>
);
}
