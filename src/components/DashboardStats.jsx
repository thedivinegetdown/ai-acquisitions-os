function getPriority(deal) {
  const lead = Number(deal.lead_score || 0);
  const motivation = Number(deal.motivation || 0);

  let score = lead + motivation;

  if (deal.stage === "Offer Sent") score += 2;
  if (deal.stage === "Under Contract") score += 3;

  if (score >= 14) return "hot";
  if (score >= 8) return "warm";
  return "cold";
}

function StatCard({ title, value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          marginBottom: 8,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function DashboardStats({ deals }) {
  const totalDeals = deals.length;

  const hotLeads = deals.filter(
    (deal) => getPriority(deal) === "hot"
  ).length;

  const underContract = deals.filter(
    (deal) => deal.stage === "Under Contract"
  ).length;

  const closed = deals.filter(
    (deal) => deal.stage === "Closed"
  ).length;

  const pipelineValue = deals.reduce((sum, deal) => {
    return sum + Number(deal.price || 0);
  }, 0);

  const money = pipelineValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <StatCard title="Total Deals" value={totalDeals} />
      <StatCard title="Hot Leads" value={hotLeads} />
      <StatCard title="Under Contract" value={underContract} />
      <StatCard title="Closed" value={closed} />
      <StatCard title="Pipeline Value" value={money} />
    </div>
  );
}