function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function RevenueBoard({ deals }) {
  const closedDeals = deals.filter(
    (d) => d.stage === "Closed"
  );

  const totalRevenue = closedDeals.reduce(
    (sum, d) => sum + Number(d.assignment_fee || 0),
    0
  );

  const avgProfit =
    closedDeals.length === 0
      ? 0
      : totalRevenue / closedDeals.length;

  const biggestWin = closedDeals.reduce(
    (max, d) =>
      Math.max(
        max,
        Number(d.assignment_fee || 0)
      ),
    0
  );

  const pipelineProfit = deals
    .filter(
      (d) =>
        d.stage === "Under Contract"
    )
    .reduce((sum, d) => {
      return (
        sum +
        Number(
          d.assignment_fee || 0
        )
      );
    }, 0);

  const thisMonth = new Date()
    .toISOString()
    .slice(0, 7);

  const monthlyClosed =
    closedDeals.filter(
      (d) =>
        d.closing_date &&
        d.closing_date.startsWith(
          thisMonth
        )
    ).length;

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
          padding: 18,
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
        title="Total Revenue"
        value={money(
          totalRevenue
        )}
      />

      <Card
        title="Pipeline Profit"
        value={money(
          pipelineProfit
        )}
      />

      <Card
        title="Avg Profit"
        value={money(
          avgProfit
        )}
      />

      <Card
        title="Biggest Win"
        value={money(
          biggestWin
        )}
      />

      <Card
        title="Closed This Month"
        value={monthlyClosed}
      />
    </div>
  );
}