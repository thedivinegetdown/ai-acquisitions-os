import { useMemo, useState } from "react";
import {
  buildActionInbox,
  markNotificationCompleted,
  markNotificationSeen,
  snoozeNotification,
} from "../services/notifications";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

const priorityColors = {
  Low: { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" },
  Medium: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  High: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  Critical: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
};

function Pill({ label, priority }) {
  const colors = priorityColors[priority] || priorityColors.Low;

  return (
    <span
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        color: colors.text,
        fontSize: 12,
        fontWeight: 800,
        padding: "5px 8px",
      }}
    >
      {label}
    </span>
  );
}

function ActionButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: 800,
        padding: "7px 9px",
      }}
    >
      {children}
    </button>
  );
}

function NotificationCard({
  notification,
  onOpenDeal,
  onSelectPhone,
  onSeen,
  onCompleted,
  onSnooze,
}) {
  function runShortcut() {
    if (notification.action === "open-conversation") {
      onSelectPhone?.(notification.deal?.phone);
      return;
    }

    if (notification.deal) {
      onOpenDeal?.(notification.deal);
    }
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div>
          <strong>{notification.title}</strong>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
            {notification.category}
            {notification.requiresApproval ? " | Requires approval" : ""}
          </div>
        </div>
        <Pill label={notification.priority} priority={notification.priority} />
      </div>
      <p style={{ color: "#334155", margin: "8px 0" }}>{notification.reason}</p>
      <p style={{ color: "#334155", margin: "8px 0" }}>
        <strong>Recommended action:</strong> {notification.recommendedAction}
      </p>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>
        Seller: {notification.relatedSeller || "None"} | Deal:{" "}
        {notification.relatedDeal || "None"} | Status: {notification.status} |
        Created: {new Date(notification.createdAt).toLocaleString()}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionButton onClick={runShortcut}>
          {notification.action === "open-conversation"
            ? "Open conversation"
            : "Open seller workspace"}
        </ActionButton>
        <ActionButton onClick={() => onSeen(notification.id)}>Mark seen</ActionButton>
        <ActionButton onClick={() => onCompleted(notification.id)}>
          Mark completed
        </ActionButton>
        <ActionButton onClick={() => onSnooze(notification.id)}>Snooze</ActionButton>
      </div>
    </div>
  );
}

export default function ActionInboxPanel({
  deals = [],
  openDeal,
  setSelectedPhone,
}) {
  const [groupBy, setGroupBy] = useState("priority");
  const [stateById, setStateById] = useState({});
  const inbox = useMemo(
    () => buildActionInbox({ deals, stateById, groupBy }),
    [deals, groupBy, stateById]
  );

  function snooze(id) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setStateById((current) => snoozeNotification(current, id, tomorrow));
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        marginBottom: 24,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Notification Center / Action Inbox
          </div>
          <h2 style={{ color: "#0f172a", margin: "4px 0 0" }}>
            Action Inbox
          </h2>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Local/manual notification state. No external actions are executed.
          </p>
        </div>
        <select
          value={groupBy}
          onChange={(event) => setGroupBy(event.target.value)}
          style={{
            alignSelf: "flex-start",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: "9px 10px",
          }}
        >
          <option value="priority">Group by priority</option>
          <option value="category">Group by category</option>
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <div style={cardStyle}>
          <strong>{inbox.notifications.length}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Active items</div>
        </div>
        <div style={cardStyle}>
          <strong>{inbox.criticalCount}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Critical</div>
        </div>
        <div style={cardStyle}>
          <strong>{inbox.overdueCount}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Overdue</div>
        </div>
        <div style={cardStyle}>
          <strong>{Object.keys(inbox.groupedNotifications).length}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Groups</div>
        </div>
      </div>

      <div style={{ ...cardStyle, color: "#334155", marginBottom: 12 }}>
        <strong>Recommended next action:</strong> {inbox.recommendedNextAction}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {inbox.notifications.length === 0 ? (
          <div style={cardStyle}>No active notifications require attention.</div>
        ) : (
          Object.entries(inbox.groupedNotifications).map(([group, notifications]) => (
            <div key={group} style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>{group}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onOpenDeal={openDeal}
                    onSelectPhone={setSelectedPhone}
                    onSeen={(id) =>
                      setStateById((current) => markNotificationSeen(current, id))
                    }
                    onCompleted={(id) =>
                      setStateById((current) =>
                        markNotificationCompleted(current, id)
                      )
                    }
                    onSnooze={snooze}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {(inbox.risks.length > 0 || inbox.missingData.length > 0) && (
        <div style={{ ...cardStyle, color: "#64748b", marginTop: 12 }}>
          {[...inbox.risks, ...inbox.missingData].join(" ")}
        </div>
      )}
    </section>
  );
}
