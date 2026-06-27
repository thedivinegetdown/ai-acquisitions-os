import { formatSafeDate } from "../utils/dates";

function isSameDate(a, b) {
  return a === b;
}

function TaskCard({
  title,
  count,
  bg,
  color,
}) {
  return (
    <div
      style={{
        background: bg,
        color,
        borderRadius: 14,
        padding: 18,
        fontWeight: "bold",
      }}
    >
      <div style={{ fontSize: 13 }}>
        {title}
      </div>

      <div style={{ fontSize: 32 }}>
        {count}
      </div>
    </div>
  );
}

export default function TaskDashboard({
  deals,
  openDeal,
}) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const dueToday = deals.filter(
    (deal) =>
      deal.due_date &&
      isSameDate(deal.due_date, today)
  );

  const overdue = deals.filter(
    (deal) =>
      deal.due_date &&
      deal.due_date < today
  );

  const upcoming = deals.filter(
    (deal) =>
      deal.due_date &&
      deal.due_date > today
  );

  const focus = [...overdue, ...dueToday]
    .slice(0, 5);

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <TaskCard
          title="Due Today"
          count={dueToday.length}
          bg="#dbeafe"
          color="#1e3a8a"
        />

        <TaskCard
          title="Overdue"
          count={overdue.length}
          bg="#fee2e2"
          color="#991b1b"
        />

        <TaskCard
          title="Upcoming"
          count={upcoming.length}
          bg="#dcfce7"
          color="#166534"
        />
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          Follow-Up Focus List
        </h3>

        {focus.length === 0 ? (
          <p>No urgent follow-ups.</p>
        ) : (
          focus.map((deal) => (
            <div
              key={deal.id}
              onClick={() =>
                openDeal(deal)
              }
              style={{
                padding: "10px 0",
                borderBottom:
                  "1px solid #f1f5f9",
                cursor: "pointer",
              }}
            >
              <strong>
                {deal.property_address}
              </strong>

              <div
                style={{
                  fontSize: 14,
                  color: "#475569",
                }}
              >
                {deal.next_action ||
                  "No action"}{" "}
                • Due{" "}
                {formatSafeDate(deal.due_date, "-")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}