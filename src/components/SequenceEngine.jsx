import { useEffect, useState } from "react";
import {
  createSequenceSteps,
  listSequencesByDeal,
  updateSequenceStep,
} from "../services/repositories";

const STEPS = [
  { day: 0, type: "Call" },
  { day: 2, type: "Text" },
  { day: 5, type: "Call" },
  { day: 10, type: "Email" },
  { day: 20, type: "Re-engage" },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SequenceEngine({
  deal,
}) {
  const [rows, setRows] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    loadRows();
  }, [deal.id]);

  async function loadRows() {
    setLoading(true);

    const result = await listSequencesByDeal(deal.id);

    if (!result.success) {
      console.error(result.error);
      setRows([]);
    } else {
      setRows(result.data || []);
    }

    setLoading(false);
  }

  async function generate() {
    setSaving(true);

    const payload =
      STEPS.map((step) => ({
        deal_id: deal.id,
        step_day: step.day,
        action_type:
          step.type,
        due_date: addDays(
          step.day
        ),
      }));

    const result = await createSequenceSteps(payload);

    if (!result.success) {
      console.error(result.error);
      alert("Could not create sequence");
    } else {
      loadRows();
    }

    setSaving(false);
  }

  async function markDone(id) {
    const result = await updateSequenceStep(id, {
      status: "Completed",
    });

    if (result.success) {
      loadRows();
    }
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
        Follow-Up Sequence
      </h3>

      {rows.length === 0 ? (
        <button
          onClick={
            generate
          }
        >
          {saving
            ? "Creating..."
            : "Generate Sequence"}
        </button>
      ) : loading ? (
        <p>Loading...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {rows.map(
            (row) => (
              <div
                key={row.id}
                style={{
                  background:
                    "#fff",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                  }}
                >
                  Day {row.step_day} —{" "}
                  {
                    row.action_type
                  }
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color:
                      "#475569",
                    marginTop: 4,
                  }}
                >
                  Due:{" "}
                  {
                    row.due_date
                  }{" "}
                  •{" "}
                  {
                    row.status
                  }
                </div>

                {row.status !==
                "Completed" ? (
                  <button
                    onClick={() =>
                      markDone(
                        row.id
                      )
                    }
                    style={{
                      marginTop: 8,
                    }}
                  >
                    Mark Done
                  </button>
                ) : null}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
