export function DashboardWidget({ title, children }) {
  return (
    <section
      style={{
        marginBottom: 22,
      }}
    >
      <h2
        style={{
          fontSize: 20,
          margin: "0 0 12px",
          color: "#0f172a",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function MetricCard({ label, value, sub }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <strong
        style={{
          color: "#0f172a",
          fontSize: 24,
        }}
      >
        {value}
      </strong>
      {sub ? (
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{sub}</div>
      ) : null}
    </div>
  );
}

export function MetricGrid({ metrics }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
      }}
    >
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          sub={metric.sub}
        />
      ))}
    </div>
  );
}
