import { useState } from "react";
import { updateDeal } from "../services/repositories";

function money(value) {
  const num = Number(value || 0);
  if (!num) return "-";

  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const STATUSES = [
  "Not Started",
  "Talking",
  "Offer Sent",
  "Counter Received",
  "Accepted",
  "Dead",
];

export default function NegotiationTracker({
  deal,
  refresh,
}) {
  const [sellerAsk, setSellerAsk] = useState(
    deal.seller_ask || ""
  );

  const [latestOffer, setLatestOffer] =
    useState(
      deal.latest_offer || ""
    );

  const [counterOffer, setCounterOffer] =
    useState(
      deal.counter_offer || ""
    );

  const [objection, setObjection] =
    useState(
      deal.objection || ""
    );

  const [status, setStatus] = useState(
    deal.negotiation_status ||
      "Not Started"
  );

  const [saving, setSaving] =
    useState(false);

  async function save() {
    setSaving(true);

    const result = await updateDeal(deal.id, {
        seller_ask:
          sellerAsk === ""
            ? null
            : Number(
                sellerAsk
              ),
        latest_offer:
          latestOffer === ""
            ? null
            : Number(
                latestOffer
              ),
        counter_offer:
          counterOffer === ""
            ? null
            : Number(
                counterOffer
              ),
        objection,
        negotiation_status:
          status,
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
        Negotiation Tracker
      </h3>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <input
          type="number"
          placeholder="Seller Asking Price"
          value={sellerAsk}
          onChange={(e) =>
            setSellerAsk(
              e.target.value
            )
          }
        />

        <input
          type="number"
          placeholder="Your Latest Offer"
          value={latestOffer}
          onChange={(e) =>
            setLatestOffer(
              e.target.value
            )
          }
        />

        <input
          type="number"
          placeholder="Counter Offer"
          value={counterOffer}
          onChange={(e) =>
            setCounterOffer(
              e.target.value
            )
          }
        />

        <select
          value={status}
          onChange={(e) =>
            setStatus(
              e.target.value
            )
          }
        >
          {STATUSES.map(
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

        <textarea
          rows="3"
          placeholder="Seller objection or notes"
          value={objection}
          onChange={(e) =>
            setObjection(
              e.target.value
            )
          }
        />

        <button onClick={save}>
          {saving
            ? "Saving..."
            : "Save Negotiation"}
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          lineHeight: 1.8,
          color: "#475569",
        }}
      >
        <div>
          Ask: {money(sellerAsk)}
        </div>
        <div>
          Offer: {money(latestOffer)}
        </div>
        <div>
          Counter: {money(counterOffer)}
        </div>
        <div>
          Status: {status}
        </div>
      </div>
    </div>
  );
}
