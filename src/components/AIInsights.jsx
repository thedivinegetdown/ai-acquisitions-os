function getNumbers(deal) {
  const lead = Number(deal.lead_score || 0);
  const motivation = Number(deal.motivation || 0);
  const price = Number(deal.price || 0);
  const arv = Number(deal.arv || 0);
  const repairs = Number(deal.repairs || 0);

  const mao =
    arv > 0 ? arv * 0.7 - repairs : 0;

  const spread =
    mao > 0 ? mao - price : 0;

  return {
    lead,
    motivation,
    price,
    arv,
    repairs,
    mao,
    spread,
  };
}

export default function AIInsights({
  deal,
}) {
  const {
    lead,
    motivation,
    spread,
  } = getNumbers(deal);

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const overdue =
    deal.due_date &&
    deal.due_date < today;

  let status = "❌ Low Priority";
  let bg = "#fee2e2";
  let color = "#991b1b";
  let summary =
    "This lead currently shows weak signals.";
  let action =
    "Keep in nurture sequence.";

  if (
    lead >= 7 &&
    motivation >= 7
  ) {
    status = "🔥 Pursue Now";
    bg = "#dcfce7";
    color = "#166534";
    summary =
      "High motivation and strong seller signals detected.";
    action =
      "Call immediately and work toward offer.";
  } else if (
    lead >= 5 ||
    motivation >= 5
  ) {
    status =
      "⚡ Worth Following Up";
    bg = "#fef3c7";
    color = "#92400e";
    summary =
      "There is potential here, but stronger engagement is needed.";
    action =
      "Text / call and qualify motivation.";
  }

  if (spread > 15000) {
    summary +=
      " Deal spread looks attractive based on saved numbers.";
  }

  if (deal.stage === "Under Contract") {
    status = "🔥 Push to Close";
    bg = "#dbeafe";
    color = "#1e3a8a";
    summary =
      "This deal is already under contract. Focus on closing and execution.";
    action =
      "Coordinate title, buyer, and closing steps.";
  }

  if (overdue) {
    action =
      "Overdue follow-up detected. Contact seller today.";
  }

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop:
          "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        AI Decision Engine
      </h3>

      <div
        style={{
          background: bg,
          color,
          borderRadius: 14,
          padding: 16,
          fontWeight: "bold",
          marginBottom: 12,
        }}
      >
        {status}
      </div>

      <div
        style={{
          lineHeight: 1.7,
          color: "#334155",
        }}
      >
        <div>
          <strong>Summary:</strong>{" "}
          {summary}
        </div>

        <div
          style={{
            marginTop: 10,
          }}
        >
          <strong>
            Next Best Action:
          </strong>{" "}
          {action}
        </div>
      </div>
    </div>
  );
}