import { useEffect, useMemo, useState } from "react";
import { loadMessageLogs } from "../services/conversations";
import { sendOutboundSms } from "../services/sms";

export default function MessageCenter({ deal }) {
  const property = deal?.property_address || "your property";

  // 🔥 MESSAGE TEMPLATES
  const templates = {
    initial: `Hi, I'm reaching out about ${property}. Would you consider an offer?`,
    followup: `Just following up on ${property}. Would you be open to discussing an offer?`,
    offer: `I can make a cash offer on ${property}. Would you like to hear the numbers?`,
    checkin: `Hey just checking in on ${property}. Let me know if you're still interested in selling.`,
  };

  const defaultMessage = useMemo(() => templates.initial, [property]);

  const [message, setMessage] = useState(defaultMessage);
  const [phone, setPhone] = useState(deal?.phone || "");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentDealId =
    deal?.id ||
    deal?.deal_id ||
    deal?.lead_id ||
    deal?.Id ||
    deal?.uuid ||
    null;

  useEffect(() => {
    setMessage(defaultMessage);
    setPhone(deal?.phone || "");
  }, [defaultMessage, deal?.phone]);

  useEffect(() => {
    loadLogs();
  }, [currentDealId]);

  async function loadLogs() {
    if (!currentDealId) {
      setLogs([]);
      return;
    }

    const result = await loadMessageLogs({
      dealId: currentDealId,
      ascending: false,
    });

    if (!result.success) {
      console.error("[SMS] Load logs error:", result.error);
      setError("Could not load message history.");
      return;
    }

    setLogs(result.data);
  }

  async function sendSMS() {
    setError("");
    setSuccess("");

    if (!currentDealId) {
      setError("Missing deal record.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter a phone number.");
      return;
    }

    if (!message.trim()) {
      setError("Message cannot be empty.");
      return;
    }

    setSending(true);

    try {
      const result = await sendOutboundSms({
        to: phone.trim(),
        message: message.trim(),
        dealId: currentDealId,
      });

      if (!result.success) {
        throw new Error(result.error.message || "Send failed");
      }

      await loadLogs();

      setSuccess(
        result.data.mode === "live"
          ? "SMS sent successfully."
          : "Message saved in test mode."
      );
    } catch (err) {
      console.error("[SMS] Send error:", err);
      setError(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Message Center</h3>

      {/* 🔥 TEMPLATE BUTTONS */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setMessage(templates.initial)}>Initial</button>
        <button onClick={() => setMessage(templates.followup)}>Follow-Up</button>
        <button onClick={() => setMessage(templates.offer)}>Cash Offer</button>
        <button onClick={() => setMessage(templates.checkin)}>Check-In</button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          To
        </label>

        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter phone number"
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #d1d5db",
            borderRadius: 8,
          }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Message
        </label>

        <textarea
          rows="5"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #d1d5db",
            borderRadius: 8,
          }}
        />
      </div>

      <button onClick={sendSMS} disabled={sending}>
        {sending ? "Sending..." : "Send SMS"}
      </button>

      <div style={{ marginTop: 6 }}>{message.length} characters</div>

      {error && <div style={{ color: "red" }}>{error}</div>}
      {success && <div style={{ color: "green" }}>{success}</div>}

      <div style={{ marginTop: 16 }}>
        <strong>Send History</strong>

        {logs.length === 0 ? (
          <div>No messages yet</div>
        ) : (
          logs.map((item) => (
            <div key={item.id} style={{ marginTop: 8 }}>
              {item.phone} — {item.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
