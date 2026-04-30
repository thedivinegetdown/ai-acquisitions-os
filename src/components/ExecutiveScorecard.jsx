function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  );
}

function Card({
  title,
  value,
  sub,
}) {
  return (
    <div
      style={{
        background: "#fff",
        border:
          "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        {value}
      </div>

      {sub ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "#64748b",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function ExecutiveScorecard({
  deals,
}) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const overdue =
    deals.filter(
      (d) =>
        d.due_date &&
        d.due_date < today
    ).length;

  const activeContracts =
    deals.filter(
      (d) =>
        d.stage ===
        "Under Contract"
    ).length;

  const closed =
    deals.filter(
      (d) =>
        d.stage === "Closed"
    );

  const closeRate =
    deals.length === 0
      ? 0
      : (
          (closed.length /
            deals.length) *
          100
        ).toFixed(1);

  const revenue =
    closed.reduce(
      (sum, d) =>
        sum +
        Number(
          d.assignment_fee ||
            0
        ),
      0
    );

  const revPerDeal =
    closed.length === 0
      ? 0
      : revenue /
        closed.length;

  const touchedToday =
    deals.filter(
      (d) =>
        d.updated_at &&
        d.updated_at
          .slice(0, 10) ===
          today
    ).length;

  const owners = new Set(
    deals
      .map(
        (d) =>
          d.owner_name
      )
      .filter(Boolean)
  ).size;

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
        title="Leads Touched Today"
        value={touchedToday}
      />

      <Card
        title="Overdue"
        value={overdue}
      />

      <Card
        title="Contracts Active"
        value={
          activeContracts
        }
      />

      <Card
        title="Close Rate"
        value={`${closeRate}%`}
      />

      <Card
        title="Revenue / Closed Deal"
        value={money(
          revPerDeal
        )}
      />

      <Card
        title="Owners Active"
        value={owners}
      />
    </div>
  );
}