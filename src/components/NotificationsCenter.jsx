function buildNotifications(deals) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const items = [];

  deals.forEach((deal) => {
    const address =
      deal.property_address ||
      "Unknown Property";

    const lead = Number(
      deal.lead_score || 0
    );

    const motivation = Number(
      deal.motivation || 0
    );

    if (
      deal.due_date &&
      deal.due_date < today
    ) {
      items.push({
        id: `${deal.id}-overdue`,
        level: "urgent",
        text: `🚨 Overdue follow-up: ${address}`,
        deal,
      });
    }

    if (
      lead >= 8 &&
      motivation >= 8
    ) {
      items.push({
        id: `${deal.id}-hot`,
        level: "hot",
        text: `🔥 Hot lead ready now: ${address}`,
        deal,
      });
    }

    if (
      deal.stage ===
      "Under Contract"
    ) {
      items.push({
        id: `${deal.id}-contract`,
        level: "info",
        text: `📄 Closing pipeline needs review: ${address}`,
        deal,
      });
    }

    if (
      !deal.next_action &&
      deal.stage !== "Closed"
    ) {
      items.push({
        id: `${deal.id}-missing`,
        level: "info",
        text: `📝 Missing next action: ${address}`,
        deal,
      });
    }
  });

  return items.slice(0, 12);
}

function getColor(level) {
  if (level === "urgent")
    return "#991b1b";
  if (level === "hot")
    return "#166534";
  return "#1e3a8a";
}

export default function NotificationsCenter({
  deals,
  openDeal,
}) {
  const items =
    buildNotifications(
      deals
    );

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
        Notifications Center
      </h2>

      {items.length === 0 ? (
        <p>No alerts right now.</p>
      ) : (
        items.map(
          (
            item,
            index
          ) => (
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
                  items.length -
                    1
                    ? "none"
                    : "1px solid #f1f5f9",
                cursor:
                  "pointer",
                color:
                  getColor(
                    item.level
                  ),
                fontWeight: 700,
              }}
            >
              {item.text}
            </div>
          )
        )
      )}
    </div>
  );
}