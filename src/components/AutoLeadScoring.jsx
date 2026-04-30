function value(v) {
  return Number(v || 0);
}

function scoreDeal(deal) {
  let score = 0;

  score += value(
    deal.lead_score
  ) * 2;

  score += value(
    deal.motivation
  ) * 3;

  const source =
    String(
      deal.source || ""
    ).toLowerCase();

  if (
    source.includes(
      "referral"
    )
  )
    score += 8;

  if (
    source.includes(
      "ppc"
    ) ||
    source.includes(
      "google"
    )
  )
    score += 5;

  const stage =
    deal.stage ||
    "New Lead";

  if (
    stage ===
    "Offer Sent"
  )
    score += 6;

  if (
    stage ===
    "Under Contract"
  )
    score += 10;

  if (
    !deal.owner_name
  )
    score -= 3;

  if (
    !deal.next_action
  )
    score -= 2;

  if (
    !deal.property_address
  )
    score -= 10;

  return score;
}

export default function AutoLeadScoring({
  deals,
  applyView,
}) {
  const ranked =
    [...deals]
      .map((deal) => ({
        ...deal,
        auto_score:
          scoreDeal(
            deal
          ),
      }))
      .sort(
        (a, b) =>
          b.auto_score -
          a.auto_score
      );

  const topFive =
    ranked.slice(0, 5);

  return (
    <div
      style={{
        marginBottom: 24,
        background: "#fff",
        border:
          "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Auto Lead Scoring
      </h2>

      <div
        style={{
          marginBottom: 12,
          color: "#475569",
        }}
      >
        Smart ranking based on
        motivation, source,
        stage, and data quality.
      </div>

      <button
        onClick={() =>
          applyView(
            ranked
          )
        }
        style={{
          padding:
            "10px 14px",
          borderRadius: 10,
          border: "none",
          background:
            "#0f172a",
          color: "#fff",
          cursor:
            "pointer",
          fontWeight: 700,
          marginBottom: 14,
        }}
      >
        View Ranked Leads
      </button>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {topFive.map(
          (deal) => (
            <div
              key={deal.id}
              style={{
                background:
                  "#f8fafc",
                padding: 10,
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              <strong>
                {
                  deal.property_address
                }
              </strong>{" "}
              — Score:{" "}
              {
                deal.auto_score
              }
            </div>
          )
        )}
      </div>
    </div>
  );
}