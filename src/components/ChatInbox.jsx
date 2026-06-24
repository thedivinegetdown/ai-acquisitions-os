import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ChatInbox() {
const [messages, setMessages] = useState([]);

useEffect(() => {
loadMessages();

const subscription = supabase
  .channel("sms-inbox")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "message_logs",
    },
    (payload) => {
      console.log("NEW MESSAGE:", payload.new);

      setMessages((current) => [
        payload.new,
        ...current,
      ]);
    }
  )
  .subscribe();

return () => {
  supabase.removeChannel(subscription);
};

}, []);

async function loadMessages() {
const { data, error } = await supabase
.from("message_logs")
.select("*")
.order("created_at", {
ascending: false,
});

console.log("MESSAGES:", data);
console.log("ERROR:", error);

if (error) {
  console.error(error);
  return;
}

setMessages(data || []);

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
