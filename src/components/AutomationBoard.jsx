function daysBetween(dateString) {
  if (!dateString) return 999;

  const today = new Date();
  const target = new Date(dateString + "T00:00:00");

  const diff =
    today.getTime() - target.getTime();

  return Math.floor(
    diff / (1000 * 60 * 60 * 24)
  );
}

function buildActions(deals) {
  const items = [];
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  deals.forEach((deal) => {
    const address =
      deal.property_address ||
      "Unknown Property";

    if (
      deal.due_date &&
      deal.due_date < today
    ) {
      items.push({
        id: `${deal.id}-overdue`,
        priority: 10,
        text: `🚨 Overdue follow-up: ${address}`,
        deal,
      });
    }

    if (
      !deal.next_action &&
      deal.stage !== "Closed"
    ) {
      items.push({
        id: `${deal.id}-next`,
        priority: 8,
        text: `📝 Add next action: ${address}`,
        deal,
      });
    }

    if (
      deal.stage ===
      "Under Contract"
    ) {
      items.push({
        id: `${deal.id}-contract`,
        priority: 9,
        text: `📄 Check closing progress: ${address}`,
        deal,
      });
    }

    const staleDays = Math.max(
      daysBetween(
        deal.due_date
      ),
      0
    );

    if (
      staleDays > 14 &&
      deal.stage ===
        "New Lead"
    ) {
      items.push({
        id: `${deal.id}-stale`,
        priority: 7,
        text: `📞 Re-engage stale lead: ${address}`,
        deal,
      });
    }
  });

  return items
    .sort(
      (a, b) =>
        b.priority -
        a.priority
    )
    .slice(0, 10);
}

export default function AutomationBoard({
  deals,
  openDeal,
}) {
  const actions =
    buildActions(deals);

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
      <h2 style={{ marginTop: 0 }}>
        Automation Engine
      </h2>

      {actions.length === 0 ? (
        <p>
          No automated actions
          right now.
        </p>
      ) : (
        actions.map(
          (item, index) => (
            <div
              key={item.id}
              onClick={() =>
                openDeal(
                  item.deal
                )
              }
              style={{
                padding:
                  "12px 0",
                borderBottom:
                  index ===
                  actions.length -
                    1
                    ? "none"
                    : "1px solid #f1f5f9",
                cursor:
                  "pointer",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                }}
              >
                {item.text}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color:
                    "#64748b",
                  marginTop: 4,
                }}
              >
                Priority:{" "}
                {
                  item.priority
                }
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}