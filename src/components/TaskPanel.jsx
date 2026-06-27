import { useState } from "react";
import { updateDeal } from "../services/repositories";

const SOURCES = [
  "Driving for Dollars",
  "Cold Calling",
  "SMS",
  "PPC",
  "SEO",
  "Referral",
  "Agent",
  "Direct Mail",
];

export default function TaskPanel({
  deal,
  refresh,
}) {
  const [nextAction, setNextAction] =
    useState(
      deal.next_action || ""
    );

  const [dueDate, setDueDate] =
    useState(
      deal.due_date || ""
    );

  const [notes, setNotes] =
    useState(
      deal.notes || ""
    );

  const [source, setSource] =
    useState(
      deal.source || ""
    );

  const [saving, setSaving] =
    useState(false);

  async function saveTask() {
    setSaving(true);

    const result = await updateDeal(deal.id, {
        next_action:
          nextAction,
        due_date:
          dueDate || null,
        notes,
        source:
          source || null,
      });

    if (!result.success) {
      console.error(result.error);
      alert(
        "Error saving"
      );
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
        Follow-Up Task
      </h3>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <input
          placeholder="Next Action"
          value={nextAction}
          onChange={(e) =>
            setNextAction(
              e.target.value
            )
          }
        />

        <input
          type="date"
          value={dueDate}
          onChange={(e) =>
            setDueDate(
              e.target.value
            )
          }
        />

        <select
          value={source}
          onChange={(e) =>
            setSource(
              e.target.value
            )
          }
        >
          <option value="">
            Select Source
          </option>

          {SOURCES.map((item) => (
            <option
              key={item}
              value={item}
            >
              {item}
            </option>
          ))}
        </select>

        <textarea
          rows="4"
          placeholder="Notes"
          value={notes}
          onChange={(e) =>
            setNotes(
              e.target.value
            )
          }
        />

        <button
          onClick={saveTask}
        >
          {saving
            ? "Saving..."
            : "Save Task"}
        </button>
      </div>
    </div>
  );
}
