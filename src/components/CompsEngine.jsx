import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function CompsEngine({ deal, refresh }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    address: "",
    sale_price: "",
    sqft: "",
    beds: "",
    baths: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadComps();
  }, [deal.id]);

  async function loadComps() {
    const { data, error } = await supabase
      .from("comps")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows(data || []);
    }
  }

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveComp(e) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("comps")
      .insert([
        {
          deal_id: deal.id,
          address: form.address,
          sale_price:
            form.sale_price === ""
              ? null
              : Number(form.sale_price),
          sqft:
            form.sqft === ""
              ? null
              : Number(form.sqft),
          beds:
            form.beds === ""
              ? null
              : Number(form.beds),
          baths:
            form.baths === ""
              ? null
              : Number(form.baths),
        },
      ]);

    if (error) {
      console.error(error);
      alert("Error saving comp");
    } else {
      setForm({
        address: "",
        sale_price: "",
        sqft: "",
        beds: "",
        baths: "",
      });

      loadComps();
      refresh();
    }

    setSaving(false);
  }

  const avg =
    rows.length === 0
      ? 0
      : rows.reduce(
          (sum, r) =>
            sum +
            Number(r.sale_price || 0),
          0
        ) / rows.length;

  const asking = Number(deal.price || 0);
  const spread = avg - asking;

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Comps Engine
      </h3>

      <form
        onSubmit={saveComp}
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <input
          placeholder="Comp Address"
          value={form.address}
          onChange={(e) =>
            update("address", e.target.value)
          }
          required
        />

        <input
          type="number"
          placeholder="Sale Price"
          value={form.sale_price}
          onChange={(e) =>
            update(
              "sale_price",
              e.target.value
            )
          }
        />

        <input
          type="number"
          placeholder="Sqft"
          value={form.sqft}
          onChange={(e) =>
            update("sqft", e.target.value)
          }
        />

        <input
          type="number"
          placeholder="Beds"
          value={form.beds}
          onChange={(e) =>
            update("beds", e.target.value)
          }
        />

        <input
          type="number"
          placeholder="Baths"
          value={form.baths}
          onChange={(e) =>
            update("baths", e.target.value)
          }
        />

        <button type="submit">
          {saving
            ? "Saving..."
            : "Add Comp"}
        </button>
      </form>

      <div
        style={{
          lineHeight: 1.8,
          marginBottom: 14,
        }}
      >
        <div>
          <strong>
            Avg Comp Value:
          </strong>{" "}
          {money(avg)}
        </div>

        <div>
          <strong>
            Suggested ARV:
          </strong>{" "}
          {money(avg)}
        </div>

        <div>
          <strong>
            Spread vs Asking:
          </strong>{" "}
          {money(spread)}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              background: "#fff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <strong>
              {row.address}
            </strong>
            <div>
              {money(
                row.sale_price
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}