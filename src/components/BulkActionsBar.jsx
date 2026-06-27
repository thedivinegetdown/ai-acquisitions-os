import { useState } from "react";
import { updateDeals } from "../services/repositories";

const STAGES = [
  "New Lead",
  "Contacted",
  "Offer Sent",
  "Under Contract",
  "Closed",
];

export default function BulkActionsBar({
  selectedIds,
  clearSelection,
  refresh,
}) {
  const [stage, setStage] =
    useState("");

  const [owner, setOwner] =
    useState("");

  const [source, setSource] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const count =
    selectedIds.length;

  if (count === 0) {
    return null;
  }

  async function runUpdate(
    payload
  ) {
    setSaving(true);

    const result = await updateDeals(selectedIds, payload);

    if (!result.success) {
      console.error(result.error);
      alert("Bulk update failed");
    } else {
      clearSelection();
      refresh();
    }

    setSaving(false);
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 10,
        zIndex: 50,
        background: "#0f172a",
        color: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        {count} Selected
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <select
          value={stage}
          onChange={(e) =>
            setStage(
              e.target.value
            )
          }
        >
          <option value="">
            Change Stage
          </option>

          {STAGES.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}
        </select>

        <button
          onClick={() =>
            runUpdate({
              stage,
            })
          }
          disabled={
            !stage ||
            saving
          }
        >
          Update Stage
        </button>

        <input
          placeholder="Assign Owner"
          value={owner}
          onChange={(e) =>
            setOwner(
              e.target.value
            )
          }
        />

        <button
          onClick={() =>
            runUpdate({
              owner_name:
                owner,
            })
          }
          disabled={
            !owner ||
            saving
          }
        >
          Assign Owner
        </button>

        <input
          placeholder="Set Source"
          value={source}
          onChange={(e) =>
            setSource(
              e.target.value
            )
          }
        />

        <button
          onClick={() =>
            runUpdate({
              source,
            })
          }
          disabled={
            !source ||
            saving
          }
        >
          Set Source
        </button>

        <button
          onClick={
            clearSelection
          }
        >
          Clear
        </button>
      </div>
    </div>
  );
}
