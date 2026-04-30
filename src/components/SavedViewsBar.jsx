function thisMonth() {
  return new Date()
    .toISOString()
    .slice(0, 7);
}

export default function SavedViewsBar({
  deals,
  applyView,
}) {
  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const views = [
    {
      label: "All Deals",
      run: () => deals,
    },
    {
      label: "Hot Leads",
      run: () =>
        deals.filter(
          (d) =>
            Number(
              d.lead_score || 0
            ) >= 8 &&
            Number(
              d.motivation || 0
            ) >= 8
        ),
    },
    {
      label:
        "Overdue Follow-Ups",
      run: () =>
        deals.filter(
          (d) =>
            d.due_date &&
            d.due_date < today
        ),
    },
    {
      label:
        "Under Contract",
      run: () =>
        deals.filter(
          (d) =>
            d.stage ===
            "Under Contract"
        ),
    },
    {
      label: "My Leads",
      run: () =>
        deals.filter(
          (d) =>
            d.owner_name
        ),
    },
    {
      label: "Dead Leads",
      run: () =>
        deals.filter(
          (d) =>
            d.negotiation_status ===
            "Dead"
        ),
    },
    {
      label:
        "Closings This Month",
      run: () =>
        deals.filter(
          (d) =>
            d.closing_date &&
            d.closing_date.startsWith(
              thisMonth()
            )
        ),
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      {views.map((view) => (
        <button
          key={view.label}
          onClick={() =>
            applyView(
              view.run()
            )
          }
          style={{
            padding:
              "10px 14px",
            borderRadius: 999,
            border:
              "1px solid #cbd5e1",
            background:
              "#fff",
            cursor:
              "pointer",
            fontWeight: 700,
          }}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}