function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll(",", "")
    .replaceAll("#", "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function DuplicateDetector({
  deals,
  applyDuplicates,
}) {
  const map = {};

  deals.forEach((deal) => {
    const key = normalize(
      deal.property_address
    );

    if (!key) return;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(deal);
  });

  const groups =
    Object.values(map).filter(
      (items) =>
        items.length > 1
    );

  const duplicateDeals =
    groups.flat();

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
        Duplicate Detector
      </h2>

      <div
        style={{
          marginBottom: 12,
          color: "#475569",
        }}
      >
        Duplicate Groups:{" "}
        <strong>
          {groups.length}
        </strong>{" "}
        • Duplicate Records:{" "}
        <strong>
          {
            duplicateDeals.length
          }
        </strong>
      </div>

      <button
        onClick={() =>
          applyDuplicates(
            duplicateDeals
          )
        }
        disabled={
          duplicateDeals.length ===
          0
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
        }}
      >
        View Duplicates
      </button>

      {groups.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 10,
          }}
        >
          {groups
            .slice(0, 5)
            .map(
              (
                group,
                index
              ) => (
                <div
                  key={index}
                  style={{
                    padding: 10,
                    background:
                      "#f8fafc",
                    borderRadius: 10,
                    fontSize: 14,
                  }}
                >
                  <strong>
                    {
                      group[0]
                        .property_address
                    }
                  </strong>{" "}
                  ({group.length} records)
                </div>
              )
            )}
        </div>
      )}
    </div>
  );
}