function isBlank(value) {
  return (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  );
}

function Row({
  label,
  count,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "#64748b",
          marginBottom: 8,
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        {count}
      </div>
    </div>
  );
}

export default function DataHealthCenter({
  deals,
  applyView,
}) {
  const missingAddress =
    deals.filter((d) =>
      isBlank(
        d.property_address
      )
    );

  const missingOwner =
    deals.filter((d) =>
      isBlank(
        d.owner_name
      )
    );

  const missingSource =
    deals.filter((d) =>
      isBlank(d.source)
    );

  const missingScore =
    deals.filter(
      (d) =>
        d.lead_score ===
          null ||
        d.lead_score ===
          undefined
    );

  const missingNextAction =
    deals.filter((d) =>
      isBlank(
        d.next_action
      )
    );

  const cleanupNeeded =
    deals.filter(
      (d) =>
        isBlank(
          d.property_address
        ) ||
        isBlank(
          d.owner_name
        ) ||
        isBlank(
          d.source
        ) ||
        d.lead_score ===
          null ||
        d.lead_score ===
          undefined ||
        isBlank(
          d.next_action
        )
    );

  return (
    <div
      style={{
        marginBottom: 24,
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        Data Health Center
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <Row
          label="Missing Address"
          count={
            missingAddress.length
          }
          onClick={() =>
            applyView(
              missingAddress
            )
          }
        />

        <Row
          label="Missing Owner"
          count={
            missingOwner.length
          }
          onClick={() =>
            applyView(
              missingOwner
            )
          }
        />

        <Row
          label="Missing Source"
          count={
            missingSource.length
          }
          onClick={() =>
            applyView(
              missingSource
            )
          }
        />

        <Row
          label="Missing Score"
          count={
            missingScore.length
          }
          onClick={() =>
            applyView(
              missingScore
            )
          }
        />

        <Row
          label="Missing Next Action"
          count={
            missingNextAction.length
          }
          onClick={() =>
            applyView(
              missingNextAction
            )
          }
        />

        <Row
          label="Cleanup Needed"
          count={
            cleanupNeeded.length
          }
          onClick={() =>
            applyView(
              cleanupNeeded
            )
          }
        />
      </div>
    </div>
  );
}