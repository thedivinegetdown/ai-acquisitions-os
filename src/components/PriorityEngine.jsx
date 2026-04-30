function scoreDeal(deal) {
  let score = 0;

  const lead = Number(
    deal.lead_score || 0
  );

  const motivation = Number(
    deal.motivation || 0
  );

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (
    deal.due_date &&
    deal.due_date < today
  ) {
    score += 10;
  }

  score += lead;
  score += motivation;

  if (
    deal.stage ===
    "Under Contract"
  ) {
    score += 9;
  }

  if (
    deal.negotiation_status ===
    "Counter Received"
  ) {
    score += 8;
  }

  const arv = Number(
    deal.arv || 0
  );

  const repairs = Number(
    deal.repairs || 0
  );

  const price = Number(
    deal.price || 0
  );

  const mao =
    arv > 0
      ? arv * 0.7 -
        repairs
      : 0;

  const spread =
    mao - price;

  if (spread > 15000) {
    score += 6;
  }

  return score;
}

function actionText(deal) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (
    deal.due_date &&
    deal.due_date < today
  ) {
    return `Overdue follow-up: ${deal.property_address}`;
  }

  if (
    deal.negotiation_status ===
    "Counter Received"
  ) {
    return `Respond to counter: ${deal.property_address}`;
  }

  if (
    deal.stage ===
    "Under Contract"
  ) {
    return `Push to close: ${deal.property_address}`;
  }

  if (
    Number(
      deal.lead_score || 0
    ) >= 7 &&
    Number(
      deal.motivation || 0
    ) >= 7
  ) {
    return `Hot lead: Call ${deal.property_address}`;
  }

  return `Review ${deal.property_address}`;
}

export default function PriorityEngine({
  deals,
  openDeal,
}) {
  const top = [...deals]
    .sort(
      (a, b) =>
        scoreDeal(b) -
        scoreDeal(a)
    )
    .slice(0, 5);

  return (
    <div
      style={{
        marginBottom: 24,
        background: "#ffffff",
        border:
          "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        Today’s Top Priorities
      </h2>

      {top.length === 0 ? (
        <p>No deals yet.</p>
      ) : (
        top.map(
          (deal, index) => (
            <div
              key={deal.id}
              onClick={() =>
                openDeal(deal)
              }
              style={{
                padding:
                  "12px 0",
                borderBottom:
                  index ===
                  top.length - 1
                    ? "none"
                    : "1px solid #f1f5f9",
                cursor:
                  "pointer",
              }}
            >
              <strong>
                {index + 1}.
              </strong>{" "}
              {actionText(
                deal
              )}

              <div
                style={{
                  fontSize: 13,
                  color:
                    "#64748b",
                  marginTop: 4,
                }}
              >
                Priority Score:{" "}
                {scoreDeal(
                  deal
                )}
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}