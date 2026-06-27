import { useEffect, useState } from "react";
import { createBuyer, listBuyers } from "../services/repositories";

export default function BuyersBoard() {
  const [buyers, setBuyers] =
    useState([]);

  const [form, setForm] =
    useState({
      name: "",
      email: "",
      phone: "",
      target_areas: "",
      max_price: "",
      notes: "",
    });

  const [saving, setSaving] =
    useState(false);

  async function loadBuyers() {
    const result = await listBuyers();

    if (!result.success) {
      console.error(result.error);
      setBuyers([]);
    } else {
      setBuyers(result.data || []);
    }
  }

  useEffect(() => {
    loadBuyers();
  }, []);

  function update(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function saveBuyer(e) {
    e.preventDefault();
    setSaving(true);

    const result = await createBuyer(form);

    if (!result.success) {
      console.error(result.error);
      alert("Error saving buyer");
    } else {
      setForm({
        name: "",
        email: "",
        phone: "",
        target_areas: "",
        max_price: "",
        notes: "",
      });

      loadBuyers();
    }

    setSaving(false);
  }

  return (
    <div
      style={{
        marginBottom: 24,
      }}
    >
      <h2>
        Buyers List +
        Dispositions
      </h2>

      <form
        onSubmit={saveBuyer}
        style={{
          display: "grid",
          gap: 10,
          background:
            "#ffffff",
          border:
            "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <input
          placeholder="Buyer Name"
          value={form.name}
          onChange={(e) =>
            update(
              "name",
              e.target.value
            )
          }
          required
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            update(
              "email",
              e.target.value
            )
          }
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            update(
              "phone",
              e.target.value
            )
          }
        />

        <input
          placeholder="Target Areas"
          value={
            form.target_areas
          }
          onChange={(e) =>
            update(
              "target_areas",
              e.target.value
            )
          }
        />

        <input
          type="number"
          placeholder="Max Price"
          value={form.max_price}
          onChange={(e) =>
            update(
              "max_price",
              e.target.value
            )
          }
        />

        <textarea
          rows="3"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) =>
            update(
              "notes",
              e.target.value
            )
          }
        />

        <button
          type="submit"
        >
          {saving
            ? "Saving..."
            : "Add Buyer"}
        </button>
      </form>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {buyers.map(
          (buyer) => (
            <div
              key={buyer.id}
              style={{
                background:
                  "#fff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                {buyer.name}
              </div>

              <div>
                {buyer.email ||
                  "-"}
              </div>

              <div>
                {buyer.phone ||
                  "-"}
              </div>

              <div>
                Areas:{" "}
                {buyer.target_areas ||
                  "-"}
              </div>

              <div>
                Max:{" "}
                {buyer.max_price
                  ? Number(
                      buyer.max_price
                    ).toLocaleString(
                      "en-US",
                      {
                        style:
                          "currency",
                        currency:
                          "USD",
                        maximumFractionDigits: 0,
                      }
                    )
                  : "-"}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color:
                    "#475569",
                }}
              >
                {buyer.notes ||
                  ""}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
