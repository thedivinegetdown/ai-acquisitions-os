function Card({ title, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bar({ label, value, max }) {
  const width =
    max === 0
      ? 0
      : (value / max) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          fontSize: 14,
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div
        style={{
          height: 10,
          background: "#e5e7eb",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            background:
              "#0f172a",
          }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsBoard({
  deals,
}) {
  const stages = [
    "New Lead",
    "Contacted",
    "Offer Sent",
    "Under Contract",
    "Closed",
  ];

  const stageCounts =
    stages.map((stage) => ({
      label: stage,
      value: deals.filter(
        (d) =>
          d.stage === stage
      ).length,
    }));

  const maxStage =
    Math.max(
      ...stageCounts.map(
        (x) => x.value
      ),
      1
    );

  const sources = {};
  deals.forEach((d) => {
    const key =
      d.source ||
      "Unknown";
    sources[key] =
      (sources[key] || 0) + 1;
  });

  const sourceRows =
    Object.entries(
      sources
    ).map(([k, v]) => ({
      label: k,
      value: v,
    }));

  const maxSource =
    Math.max(
      ...sourceRows.map(
        (x) => x.value
      ),
      1
    );

  const thisMonth =
    new Date()
      .toISOString()
      .slice(0, 7);

  const monthlyClosed =
    deals.filter(
      (d) =>
        d.stage ===
          "Closed" &&
        d.closing_date &&
        d.closing_date.startsWith(
          thisMonth
        )
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

  const owners = {};
  deals.forEach((d) => {
    const key =
      d.owner_name ||
      "Unassigned";
    owners[key] =
      (owners[key] || 0) + 1;
  });

  const ownerRows =
    Object.entries(
      owners
    ).map(([k, v]) => ({
      label: k,
      value: v,
    }));

  const maxOwner =
    Math.max(
      ...ownerRows.map(
        (x) => x.value
      ),
      1
    );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <Card title="Deals by Stage">
        {stageCounts.map(
          (row) => (
            <Bar
              key={row.label}
              label={row.label}
              value={row.value}
              max={maxStage}
            />
          )
        )}
      </Card>

      <Card title="Lead Sources">
        {sourceRows.map(
          (row) => (
            <Bar
              key={row.label}
              label={row.label}
              value={row.value}
              max={maxSource}
            />
          )
        )}
      </Card>

      <Card title="This Month">
        <div
          style={{
            lineHeight: 2,
          }}
        >
          <div>
            Closed Deals:{" "}
            <strong>
              {
                monthlyClosed
              }
            </strong>
          </div>

          <div>
            Revenue:{" "}
            <strong>
              ${revenue.toLocaleString()}
            </strong>
          </div>
        </div>
      </Card>

      <Card title="Team Load">
        {ownerRows.map(
          (row) => (
            <Bar
              key={row.label}
              label={row.label}
              value={row.value}
              max={maxOwner}
            />
          )
        )}
      </Card>
    </div>
  );
}