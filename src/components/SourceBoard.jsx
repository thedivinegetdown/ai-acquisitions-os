const SOURCES = [
  "Unknown",
  "Driving for Dollars",
  "Cold Calling",
  "SMS",
  "PPC",
  "SEO",
  "Referral",
  "Agent",
  "Direct Mail",
];

function Card({
  source,
  leads,
  contracts,
  closed,
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        {source}
      </div>

      <div>Leads: {leads}</div>
      <div>
        Contracts: {contracts}
      </div>
      <div>Closed: {closed}</div>
    </div>
  );
}

export default function SourceBoard({
  deals,
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          marginBottom: 14,
        }}
      >
        Source ROI Tracker
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {SOURCES.map((source) => {
          const rows = deals.filter(
            (d) =>
              (d.source ||
                "Unknown") ===
              source
          );

          const leads =
            rows.length;

          const contracts =
            rows.filter(
              (d) =>
                d.stage ===
                "Under Contract"
            ).length;

          const closed =
            rows.filter(
              (d) =>
                d.stage ===
                "Closed"
            ).length;

          if (
            leads === 0 &&
            source !==
              "Unknown"
          ) {
            return null;
          }

          return (
            <Card
              key={source}
              source={source}
              leads={leads}
              contracts={
                contracts
              }
              closed={closed}
            />
          );
        })}
      </div>
    </div>
  );
}