import { useMemo } from "react";
import { analyzeTenantReadiness } from "../services/saas";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

function MetricCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <strong>{value || "Not configured"}</strong>
    </div>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SaaSReadinessPanel() {
  const analysis = useMemo(() => analyzeTenantReadiness(), []);
  const { tenantContext } = analysis;

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
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
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            SaaS Readiness
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Multi-Tenant Foundation
          </strong>
        </div>

        <span
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 999,
            color: "#9a3412",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          SaaS foundation only - tenant enforcement is not fully active yet.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Current Organization"
          value={tenantContext.organization.name}
        />
        <MetricCard label="Current User Role" value={tenantContext.currentRole} />
        <MetricCard label="Tenant ID" value={tenantContext.tenantId} />
        <MetricCard label="Organization ID" value={tenantContext.organizationId} />
        <MetricCard label="Active Market" value={tenantContext.activeMarket} />
        <MetricCard
          label="Tenant Readiness"
          value={analysis.tenantReadinessStatus}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Missing SaaS Setup Items"
          items={analysis.missingData}
          emptyText="No missing SaaS setup items identified."
        />
        <DetailList
          title="SaaS Risks"
          items={analysis.risks}
          emptyText="No SaaS risks identified."
        />
      </div>

      <div style={cardStyle}>
        <strong>Recommended Next Setup Action</strong>
        <p style={{ color: "#334155", marginBottom: 6 }}>
          {analysis.recommendedNextAction}
        </p>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {analysis.summary} Existing single-user workflows remain unchanged.
        </div>
      </div>
    </section>
  );
}
