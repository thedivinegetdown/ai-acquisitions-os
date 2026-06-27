import { useEffect, useState } from "react";
import AsyncStateView from "./AsyncStateView";
import { loadConversationInbox } from "../services/conversations";
import { logger } from "../services/logging";

export default function ConversationInbox({
selectedPhone,
setSelectedPhone,
}) {
const [conversations, setConversations] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

useEffect(() => {
loadConversations();
}, []);

async function loadConversations() {
setLoading(true);
setError("");
const result = await loadConversationInbox();

if (!result.success) {
  logger.error("[ConversationInbox] Conversation load failed", result.error);
  setConversations([]);
  setError(result.error?.message || "Could not load conversations.");
  setLoading(false);
  return;
}

setConversations(result.data);
setLoading(false);
}

return (
<div
style={{
background: "#fff",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 20,
marginBottom: 20,
}}
> <h2>Conversations</h2>

  <AsyncStateView
    loading={loading}
    error={error}
    empty={conversations.length === 0}
    loadingMessage="Loading conversations..."
    emptyMessage="No conversations yet."
    errorMessage="Unable to load conversations"
    onRetry={loadConversations}
  >
  {conversations.map((conv) => (
    <div
      key={conv.phone}
      onClick={() =>
        setSelectedPhone(conv.phone)
      }
      style={{
        padding: 12,
        cursor: "pointer",
        borderBottom:
          "1px solid #e5e7eb",
        background:
          selectedPhone ===
          conv.phone
            ? "#f1f5f9"
            : "transparent",
      }}
    >
      <strong>
        {conv.phone}
      </strong>

      <div
        style={{
          color: "#64748b",
          marginTop: 4,
        }}
      >
        {conv.message}
        {conv.lastMessagePreview}
      </div>
    </div>
  ))}
  </AsyncStateView>
</div>

);
}
