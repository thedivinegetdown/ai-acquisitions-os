import { useState } from "react";
import { updateDeal } from "../services/repositories";

export default function CloseoutPanel({
  deal,
  refresh,
}) {
  const [fee, setFee] = useState(
    deal.assignment_fee || ""
  );

  const [date, setDate] =
    useState(
      deal.closing_date || ""
    );

  const [saving, setSaving] =
    useState(false);

  async function save() {
    setSaving(true);

    const result = await updateDeal(deal.id, {
        assignment_fee:
          fee === ""
            ? null
            : Number(fee),
        closing_date:
          date || null,
      });

    if (!result.success) {
      console.error(result.error);
      alert("Error saving");
    } else {
      refresh();
    }

    setSaving(false);
  }

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop:
          "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Closeout / Revenue
      </h3>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <input
          type="number"
          placeholder="Assignment Fee"
          value={fee}
          onChange={(e) =>
            setFee(
              e.target.value
            )
          }
        />

        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(
              e.target.value
            )
          }
        />

        <button onClick={save}>
          {saving
            ? "Saving..."
            : "Save Revenue"}
        </button>
      </div>
    </div>
  );
}
