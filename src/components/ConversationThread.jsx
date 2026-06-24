import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ConversationThread({ selectedPhone }) {
const [messages, setMessages] = useState([]);
const [loading, setLoading] = useState(false);
const [reply, setReply] = useState("");
const [sending, setSending] = useState(false);

useEffect(() => {
console.log("[ConversationThread] selectedPhone changed:", selectedPhone);

if (!selectedPhone) {
  setMessages([]);
  setReply("");
  return;
}

loadMessages();
}, [selectedPhone]);

async function loadMessages() {
setLoading(true);
console.log("[ConversationThread] Loading messages for:", selectedPhone);

const { data, error } = await supabase
.from("message_logs")
.select("*")
.eq("phone", selectedPhone)
.order("created_at", {
ascending: true,
});

if (error) {
  console.error("[ConversationThread] Message load failed:", error);
  setMessages([]);
  setLoading(false);
  return;
}

console.log("[ConversationThread] Messages loaded:", data?.length || 0);
setMessages(data || []);
setLoading(false);
}

async function sendReply() {
const trimmedReply = reply.trim();

console.log("[ConversationThread] sendReply clicked:", {
  selectedPhone,
  hasReply: !!trimmedReply,
  sending,
});

if (!selectedPhone || !trimmedReply || sending) {
  console.warn("[ConversationThread] Send blocked:", {
    selectedPhone,
    hasReply: !!trimmedReply,
    sending,
  });
  return;
}

setSending(true);

try {
  const payload = {
    to: selectedPhone,
    message: trimmedReply,
  };

  console.log("[ConversationThread] Sending SMS payload:", {
    to: payload.to,
    messageLength: payload.message.length,
  });

  const response = await fetch("/.netlify/functions/send-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let result = {};

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch (parseError) {
    console.error("[ConversationThread] Invalid send-sms JSON:", {
      responseText,
      parseError,
    });
    throw new Error("Invalid response from send-sms");
  }

  console.log("[ConversationThread] send-sms response:", {
    ok: response.ok,
    status: response.status,
    result,
  });

  if (!response.ok || result.success === false) {
    throw new Error(result.error || "Could not send SMS");
  }

  console.log("[ConversationThread] Inserting outbound message log");

  const { error } = await supabase
  .from("message_logs")
  .insert({
    phone: selectedPhone,
    message: trimmedReply,
    direction: "outbound",
  });

  if (error) {
    console.error("[ConversationThread] Outbound log insert failed:", error);
    throw error;
  }

  console.log("[ConversationThread] Outbound log inserted successfully");
  setReply("");
  await loadMessages();
} catch (error) {
  console.error("[ConversationThread] Send failed:", error);
} finally {
  setSending(false);
  console.log("[ConversationThread] Send flow complete");
}
}

if (!selectedPhone) {
return <p>Select a conversation</p>;
}

return (
<div
style={{
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 20,
}}
>
<h2 style={{ marginTop: 0 }}>
{selectedPhone}
</h2>

{loading ? (
  <p>Loading messages...</p>
) : messages.length === 0 ? (
  <p>No messages yet.</p>
) : (
  messages.map((message) => (
    <div
      key={message.id}
      style={{
      display: "flex",
      justifyContent:
        message.direction === "outbound" ? "flex-end" : "flex-start",
      padding: "8px 0",
      }}
    >
      <div
        style={{
        maxWidth: "70%",
        background:
          message.direction === "outbound" ? "#dbeafe" : "#f1f5f9",
        borderRadius: 12,
        padding: 12,
        textAlign: "left",
        }}
      >
        <div>
          {message.message}
        </div>

        <div
          style={{
          marginTop: 4,
          fontSize: 12,
          color: "#64748b",
          }}
        >
          {message.created_at}
        </div>
      </div>
    </div>
  ))
)}

<div
style={{
borderTop: "1px solid #e5e7eb",
marginTop: 16,
paddingTop: 16,
}}
>
<textarea
value={reply}
onChange={(event) => setReply(event.target.value)}
placeholder="Type a reply"
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
);
}
