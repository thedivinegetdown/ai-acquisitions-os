export default function LeadPriorityBadge({ deal }) {
  const lead = Number(deal.lead_score || 0);
  const motivation = Number(deal.motivation || 0);

  let score = lead + motivation;

  if (deal.stage === "Offer Sent") score += 2;
  if (deal.stage === "Under Contract") score += 3;

  let label = "💤 Cold";
  let bg = "#e5e7eb";
  let color = "#111827";

  if (score >= 14) {
    label = "🔥 Hot";
    bg = "#fee2e2";
    color = "#991b1b";
  } else if (score >= 8) {
    label = "⚡ Warm";
    bg = "#fef3c7";
    color = "#92400e";
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontWeight: "bold",
        fontSize: 13,
        display: "inline-block",
      }}
    >
      {label}
    </div>
  );
}