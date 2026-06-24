import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ConversationInbox({ selectedPhone, setSelectedPhone }) {
const [conversations, setConversations] = useState([]);

useEffect(() => {
loadConversations();
}, []);

async function loadConversations() {
const { data, error } = await supabase
.from("message_logs")
.select("phone, created_at")
.order("created_at", {
ascending: false,
});

if (error) {
  console.error(error);
  setConversations([]);
  return;
}

const uniqueConversations = [];
const seenPhones = new Set();

(data || []).forEach((message) => {
  if (!message.phone || seenPhones.has(message.phone)) return;

  seenPhones.add(message.phone);
  uniqueConversations.push(message);
});

setConversations(uniqueConversations);
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
Conversations
</h2>

{conversations.length === 0 ? (
  <p>No conversations yet.</p>
) : (
  conversations.map((conversation) => (
    <button
      key={conversation.phone}
      type="button"
      onClick={() => setSelectedPhone(conversation.phone)}
      style={{
      display: "block",
      width: "100%",
      textAlign: "left",
      background:
        selectedPhone === conversation.phone ? "#e0f2fe" : "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      cursor: "pointer",
      }}
    >
      <div>
        <strong>{conversation.phone}</strong>
      </div>
      <div
        style={{
        marginTop: 4,
        fontSize: 12,
        color: "#64748b",
        }}
      >
        {conversation.created_at}
      </div>
    </button>
  ))
)}
</div>
);
}
