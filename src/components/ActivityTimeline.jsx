import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const TYPES = [
  "Called Seller",
  "Text Sent",
  "Voicemail Left",
  "Offer Made",
  "Follow-up",
  "Custom Note",
];

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function ActivityTimeline({ deal }) {
  const [items, setItems] = useState([]);
  const [type, setType] = useState(TYPES[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadActivities() {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setItems([]);
    } else {
      setItems(data || []);
    }
  }

  useEffect(() => {
    if (deal?.id) {
      loadActivities();
    }
  }, [deal?.id]);

  async function addActivity() {
    setSaving(true);

    const { error } = await supabase
      .from("activities")
      .insert([
        {
          deal_id: deal.id,
          type,
          note,
        },
      ]);

    if (error) {
      console.error(error);
      alert("Error saving activity");
    } else {
      setNote("");
      loadActivities();
    }

    setSaving(false);
  }

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Activity Timeline
      </h3>

      <div
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value)
          }
        >
          {TYPES.map((item) => (
            <option
              key={item}
              value={item}
            >
              {item}
            </option>
          ))}
        </select>

        <textarea
          rows="3"
          placeholder="Add note..."
          value={note}
          onChange={(e) =>
            setNote(e.target.value)
          }
        />

        <button
          onClick={addActivity}
        >
          {saving
            ? "Saving..."
            : "Add Activity"}
        </button>
      </div>

      <div>
        {items.length === 0 ? (
          <p>No activity yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: "10px 0",
                borderBottom:
                  "1px solid #f1f5f9",
              }}
            >
              <strong>
                {item.type}
              </strong>

              <div
                style={{
                  fontSize: 14,
                  color: "#475569",
                  marginTop: 4,
                }}
              >
                {item.note ||
                  "No note"}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  marginTop: 4,
                }}
              >
                {formatDate(
                  item.created_at
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}