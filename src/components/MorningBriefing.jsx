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

export default function MorningBriefing({
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

  const hot =
    deals.filter(
      (d) =>
        Number(
          d.lead_score || 0
        ) >= 8 &&
        Number(
          d.motivation || 0
        ) >= 8
    ).length;

  const contracts =
    deals.filter(
      (d) =>
        d.stage ===
        "Under Contract"
    ).length;

  const revenue =
    deals
      .filter(
        (d) =>
          d.stage ===
          "Closed"
      )
      .reduce(
        (sum, d) =>
          sum +
          Number(
            d.assignment_fee ||
              0
          ),
        0
      );

  let topAction =
    "Review pipeline";

  if (overdue > 0) {
    topAction =
      "Handle overdue follow-ups first";
  } else if (hot > 0) {
    topAction =
      "Call hot leads now";
  } else if (
    contracts > 0
  ) {
    topAction =
      "Push contracts to closing";
  }

  return (
    <div
      style={{
        marginBottom: 24,
        background:
          "linear-gradient(135deg,#0f172a,#1e293b)",
        color: "#fff",
        borderRadius: 16,
        padding: 22,
      }}
    >
      <div
        style={{
          fontSize: 14,
          opacity: 0.8,
          marginBottom: 8,
        }}
      >
        Morning Briefing
      </div>

      <h2
        style={{
          marginTop: 0,
          marginBottom: 16,
        }}
      >
        Here’s what matters today
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <strong>
            Overdue
          </strong>
          <div>{overdue}</div>
        </div>

        <div>
          <strong>
            Hot Leads
          </strong>
          <div>{hot}</div>
        </div>

        <div>
          <strong>
            Contracts
          </strong>
          <div>
            {contracts}
          </div>
        </div>

        <div>
          <strong>
            Revenue
          </strong>
          <div>
            {money(
              revenue
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          background:
            "rgba(255,255,255,0.08)",
          borderRadius: 12,
        }}
      >
        <strong>
          Top Action:
        </strong>{" "}
        {topAction}
      </div>
    </div>
  );
}