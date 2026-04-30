function timeAgo(dateString) {
  if (!dateString)
    return "recently";

  const diff =
    Date.now() -
    new Date(
      dateString
    ).getTime();

  const mins = Math.floor(
    diff / 60000
  );
  const hours = Math.floor(
    mins / 60
  );
  const days = Math.floor(
    hours / 24
  );

  if (mins < 60)
    return `${mins}m ago`;
  if (hours < 24)
    return `${hours}h ago`;
  return `${days}d ago`;
}

function buildFeed(deals) {
  const items = [];

  deals.forEach((deal) => {
    const name =
      deal.property_address ||
      "Unknown Property";

    if (deal.created_at) {
      items.push({
        text: `🆕 New lead added: ${name}`,
        time:
          deal.created_at,
      });
    }

    if (
      deal.updated_at &&
      deal.updated_at !==
        deal.created_at
    ) {
      items.push({
        text: `✏️ Deal updated: ${name}`,
        time:
          deal.updated_at,
      });
    }

    if (
      deal.stage ===
      "Closed"
    ) {
      items.push({
        text: `💰 Deal closed: ${name}`,
        time:
          deal.closing_date ||
          deal.updated_at,
      });
    }

    if (
      deal.stage ===
      "Under Contract"
    ) {
      items.push({
        text: `📄 Under contract: ${name}`,
        time:
          deal.updated_at,
      });
    }

    if (
      deal.latest_offer
    ) {
      items.push({
        text: `🤝 Offer updated: ${name}`,
        time:
          deal.updated_at,
      });
    }
  });

  return items
    .filter(
      (x) => x.time
    )
    .sort(
      (a, b) =>
        new Date(
          b.time
        ) -
        new Date(a.time)
    )
    .slice(0, 12);
}

export default function LiveActivityFeed({
  deals,
}) {
  const feed =
    buildFeed(deals);

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
        Live Activity Feed
      </h2>

      {feed.length === 0 ? (
        <p>No activity yet.</p>
      ) : (
        feed.map(
          (
            item,
            index
          ) => (
            <div
              key={index}
              style={{
                padding:
                  "12px 0",
                borderBottom:
                  index ===
                  feed.length -
                    1
                    ? "none"
                    : "1px solid #f1f5f9",
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
                {timeAgo(
                  item.time
                )}
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}