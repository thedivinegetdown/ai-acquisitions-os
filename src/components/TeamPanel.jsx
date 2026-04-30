import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function TeamPanel({
  deal,
  refresh,
}) {
  const [owner, setOwner] =
    useState(
      deal.owner_name || ""
    );

  const [acq, setAcq] =
    useState(
      deal.acquisitions_rep ||
        ""
    );

  const [dispo, setDispo] =
    useState(
      deal.dispositions_rep ||
        ""
    );

  const [saving, setSaving] =
    useState(false);

  async function save() {
    setSaving(true);

    const { error } = await supabase
      .from("deals")
      .update({
        owner_name:
          owner || null,
        acquisitions_rep:
          acq || null,
        dispositions_rep:
          dispo || null,
      })
      .eq("id", deal.id);

    if (error) {
      console.error(error);
      alert("Error saving team");
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
        Team Ownership
      </h3>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <input
          placeholder="Owner"
          value={owner}
          onChange={(e) =>
            setOwner(
              e.target.value
            )
          }
        />

        <input
          placeholder="Acquisitions Rep"
          value={acq}
          onChange={(e) =>
            setAcq(
              e.target.value
            )
          }
        />

        <input
          placeholder="Dispositions Rep"
          value={dispo}
          onChange={(e) =>
            setDispo(
              e.target.value
            )
          }
        />

        <button onClick={save}>
          {saving
            ? "Saving..."
            : "Save Team"}
        </button>
      </div>
    </div>
  );
}