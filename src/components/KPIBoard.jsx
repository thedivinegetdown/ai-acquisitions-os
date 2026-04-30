function percent(value) {
  return `${value.toFixed(1)}%`;
}

function Card({
  title,
  value,
  subtitle,
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
        boxShadow:
          "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          fontWeight: 700,
          textTransform:
            "uppercase",
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {value}
      </div>

      {subtitle ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "#64748b",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export default function KPIBoard({
  deals,
}) {
  const total = deals.length;

  const contacted =
    deals.filter(
      (d) =>
        d.stage === "Contacted"
    ).length;

  const offers =
    deals.filter(
      (d) =>
        d.stage === "Offer Sent"
    ).length;

  const contracts =
    deals.filter(
      (d) =>
        d.stage ===
        "Under Contract"
    ).length;

  const closed =
    deals.filter(
      (d) =>
        d.stage === "Closed"
    ).length;

  const avgLead =
    total === 0
      ? 0
      : deals.reduce(
          (sum, d) =>
            sum +
            Number(
              d.lead_score || 0
            ),
          0
        ) / total;

  const contactRate =
    total === 0
      ? 0
      : (contacted / total) *
        100;

  const offerRate =
    total === 0
      ? 0
      : (offers / total) * 100;

  const closeRate =
    total === 0
      ? 0
      : (closed / total) * 100;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <Card
        title="Avg Lead Score"
        value={avgLead.toFixed(1)}
      />

      <Card
        title="Contact Rate"
        value={percent(
          contactRate
        )}
        subtitle={`${contacted}/${total} leads`}
      />

      <Card
        title="Offer Rate"
        value={percent(
          offerRate
        )}
        subtitle={`${offers} offers sent`}
      />

      <Card
        title="Close Rate"
        value={percent(
          closeRate
        )}
        subtitle={`${closed} closed`}
      />

      <Card
        title="Contracts"
        value={contracts}
        subtitle="Active deals"
      />
    </div>
  );
}