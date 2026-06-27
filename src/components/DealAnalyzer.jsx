import { useState } from "react";
import { updateDeal } from "../services/repositories";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function DealAnalyzer({ deal, refresh }) {
  const [arv, setArv] = useState(deal.arv || "");
  const [repairs, setRepairs] = useState(deal.repairs || "");
  const [price, setPrice] = useState(deal.price || "");
  const [rent, setRent] = useState(deal.rent || "");
  const [saving, setSaving] = useState(false);

  const arvNum = Number(arv || 0);
  const repairsNum = Number(repairs || 0);
  const priceNum = Number(price || 0);
  const rentNum = Number(rent || 0);

  const mao = arvNum > 0 ? arvNum * 0.7 - repairsNum : 0;
  const wholesale = mao - priceNum;
  const flip = arvNum - priceNum - repairsNum - arvNum * 0.08;
  const cashflow = rentNum - priceNum * 0.008;

  async function save() {
    setSaving(true);

    const result = await updateDeal(deal.id, {
        arv: arvNum,
        repairs: repairsNum,
        price: priceNum,
        rent: rentNum,
      });

    setSaving(false);

    if (!result.success) {
      console.error(result.error);
      alert("Error saving analysis");
      return;
    }

    refresh();
  }

  return (
    <div>
      <h3>Deal Analyzer</h3>

      <div style={{ display: "grid", gap: 10 }}>
        <input placeholder="ARV" value={arv} onChange={(e) => setArv(e.target.value)} />
        <input placeholder="Repairs" value={repairs} onChange={(e) => setRepairs(e.target.value)} />
        <input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="Rent" value={rent} onChange={(e) => setRent(e.target.value)} />
      </div>

      <div style={{ marginTop: 14, lineHeight: 1.8 }}>
        <div><strong>MAO:</strong> {money(mao)}</div>
        <div><strong>Wholesale:</strong> {money(wholesale)}</div>
        <div><strong>Flip:</strong> {money(flip)}</div>
        <div><strong>Cashflow:</strong> {money(cashflow)}</div>
      </div>

      <button onClick={save} disabled={saving} style={{ marginTop: 14 }}>
        {saving ? "Saving..." : "Save Analysis"}
      </button>
    </div>
  );
}
