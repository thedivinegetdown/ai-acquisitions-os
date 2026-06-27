function getMax(rows) {
  return Math.max(...rows.map((row) => row.value), 1);
}

export function BarList({ rows, emptyText = "Insufficient Data." }) {
  if (!rows.length) {
    return <p style={{ color: "#64748b", margin: 0 }}>{emptyText}</p>;
  }

  const max = getMax(rows);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => {
        const width = max ? Math.max(4, (row.value / max) * 100) : 0;

        return (
          <div key={row.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
            <div
              style={{
                background: "#e5e7eb",
                borderRadius: 999,
                height: 9,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#0f172a",
                  height: "100%",
                  width: `${width}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChartPanel({ title, rows }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 16 }}>{title}</h3>
      <BarList rows={rows} />
    </div>
  );
}
