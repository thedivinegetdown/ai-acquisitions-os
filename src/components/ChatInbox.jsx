import { useEffect, useState } from "react";
import {
loadAllMessageLogs,
subscribeToMessageInserts,
} from "../services/conversations";
import { logger } from "../services/logging";

export default function ChatInbox() {
const [messages, setMessages] = useState([]);

useEffect(() => {
loadMessages();

return subscribeToMessageInserts((message) => {
  logger.debug("[ChatInbox] New message received", {
    id: message.id,
    phone: message.phone,
  });

  setMessages((current) => [
    message,
    ...current,
  ]);
});

}, []);

async function loadMessages() {
const result = await loadAllMessageLogs({ ascending: false });

if (!result.success) {
  logger.error("[ChatInbox] Message load failed", result.error);
  return;
}

setMessages(result.data);

}

return (
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 20,
marginBottom: 20,
}}
>
<h2 style={{ marginTop: 0 }}>
SMS Inbox </h2>

  <div
    style={{
      marginBottom: 10,
      color: "#64748b",
      fontSize: 12,
    }}
  >
    Messages Loaded: {messages.length}
  </div>

  {messages.length === 0 ? (
    <p>No messages yet.</p>
  ) : (
    messages.map((msg) => (
      <div
        key={msg.id}
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 0",
        }}
      >
        <div>
          <strong>
            {msg.phone}
          </strong>
        </div>

        <div style={{ marginTop: 4 }}>
          {msg.message}
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#64748b",
          }}
        >
          {msg.created_at}
        </div>
      </div>
    ))
  )}
</div>

);
}
