import { useEffect, useMemo, useState } from "react";
import {
buildSmsTimelineEvent,
loadThreadMessages,
} from "../services/conversations";
import { logger } from "../services/logging";

export default function ActivityTimeline({
selectedPhone,
deal,
refreshKey,
}) {
const phone = selectedPhone || deal?.phone || "";
const [events, setEvents] = useState([]);
const [loading, setLoading] = useState(false);

const sortedEvents = useMemo(
() =>
  [...events].sort(
    (a, b) =>
      new Date(a.created_at || 0) -
      new Date(b.created_at || 0)
  ),
[events]
);

useEffect(() => {
if (!phone) {
  setEvents([]);
  return;
}

loadTimeline();
}, [phone, refreshKey]);

async function loadTimeline() {
setLoading(true);
logger.debug("[ActivityTimeline] Loading timeline", { phone });

const result = await loadThreadMessages(phone);

if (!result.success) {
  logger.error("[ActivityTimeline] Timeline load failed", result.error);
  setEvents([]);
  setLoading(false);
  return;
}

setEvents(result.data.map(buildSmsTimelineEvent));
setLoading(false);
}

if (!phone) {
return <p>Select a conversation</p>;
}

return (
<div
style={{
borderTop: "1px solid #e5e7eb",
paddingTop: 16,
}}
>
<h3
style={{
marginTop: 0,
marginBottom: 12,
}}
>
Seller Activity Timeline
</h3>

{loading ? (
  <p>Loading timeline...</p>
) : sortedEvents.length === 0 ? (
  <p>No activity yet.</p>
) : (
  <div
    style={{
    display: "grid",
    gap: 12,
    }}
  >
    {sortedEvents.map((event) => {
      const isOutbound = event.direction === "outbound";

      return (
        <div
          key={event.id}
          style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr",
          gap: 10,
          alignItems: "start",
          }}
        >
          <div
            style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: isOutbound ? "#dbeafe" : "#f1f5f9",
            color: isOutbound ? "#1d4ed8" : "#475569",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            }}
            title="SMS"
          >
            {event.icon}
          </div>

          <div
            style={{
            display: "flex",
            justifyContent: isOutbound ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
              maxWidth: "78%",
              background: isOutbound ? "#dbeafe" : "#f1f5f9",
              border: isOutbound
                ? "1px solid #bfdbfe"
                : "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 12,
              }}
            >
              <div
                style={{
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                flexWrap: "wrap",
                marginBottom: 6,
                }}
              >
                <strong>{event.actor}</strong>
                <span
                  style={{
                  color: "#64748b",
                  fontSize: 12,
                  }}
                >
                  {event.directionLabel} SMS
                </span>
              </div>

              <div>{event.preview}</div>

              <div
                style={{
                color: "#64748b",
                fontSize: 12,
                marginTop: 6,
                }}
              >
                {event.formattedDate}
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </div>
)}
</div>
);
}
