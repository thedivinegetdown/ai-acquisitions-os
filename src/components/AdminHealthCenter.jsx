import { useMemo } from "react";
import { analyzeSystemHealth } from "../services/observability";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

const labelStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
};

const statusColors = {
  Healthy: { bg: "#ecfdf5", border: "#bbf7d0", text: "#166534" },
  Warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  Error: { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" },
  "Not configured": { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" },
  Unknown: { bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9" },
};

function StatusPill({ status }) {
  const colors = statusColors[status] || statusColors.Unknown;

  return (
    <span
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        color: colors.text,
        display: "inline-block",
        fontSize: 12,
        fontWeight: 800,
        padding: "5px 9px",
      }}
    >
      {status}
    </span>
  );
}

function Metric({ label, value, status }) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <strong style={{ color: "#0f172a", fontSize: 22 }}>{value}</strong>
        {status ? <StatusPill status={status} /> : null}
      </div>
    </div>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ color: "#64748b", marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ color: "#334155", marginBottom: 0, paddingLeft: 20 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminHealthCenter({ deals = [] }) {
  const health = useMemo(() => analyzeSystemHealth({ deals }), [deals]);

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
          alignItems: "flex-start",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={labelStyle}>Admin / System Health</div>
          <h2 style={{ color: "#0f172a", margin: "4px 0 0" }}>
            Observability Health Center
          </h2>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Internal readiness snapshot for integrations, fallback paths, and
            deployment health. Secret values are never displayed.
          </p>
        </div>
        <StatusPill status={health.overallStatus} />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <Metric
          label="Overall Health"
          value={`${health.overallScore}/100`}
          status={health.overallStatus}
        />
        <Metric label="Integration Score" value={`${health.integrationScore}/100`} />
        <Metric
          label="Data Completeness"
          value={`${health.usageHealth.completenessScore}/100`}
        />
        <Metric label="Loaded Deals" value={health.usageHealth.totalDeals} />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 12,
        }}
      >
        {health.integrationStatuses.map((integration) => (
          <div key={integration.id} style={cardStyle}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <strong>{integration.label}</strong>
              <StatusPill status={integration.status} />
            </div>
            <p style={{ color: "#334155", margin: "0 0 8px" }}>
              {integration.description}
            </p>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Required config:{" "}
              {integration.requiredEnv.length
                ? integration.requiredEnv.join(", ")
                : "None"}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Missing Environment Variables"
          items={health.missingEnv}
          emptyText="No missing browser-visible environment variables detected."
        />
        <DetailList
          title="Known Warnings"
          items={health.knownWarnings}
          emptyText="No current warnings."
        />
        <DetailList
          title="Recommended Admin Actions"
          items={health.recommendedActions}
          emptyText="No admin actions recommended."
        />
      </div>

      <div style={cardStyle}>
        <strong>Recent System Events</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {health.recentEvents.map((event) => (
            <div
              key={event.id}
              style={{
                borderTop: "1px solid #e5e7eb",
                color: "#334155",
                paddingTop: 8,
              }}
            >
              <div style={{ fontWeight: 800 }}>{event.name}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {event.status} - {new Date(event.timestamp).toLocaleString()}
              </div>
              <div style={{ marginTop: 4 }}>{event.message}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
