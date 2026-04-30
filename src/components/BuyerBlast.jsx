import { useState } from "react";

function money(value) {
  const num = Number(value || 0);

  if (!num) return "-";

  return num.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  );
}

function getStrategy(deal) {
  const arv =
    Number(deal.arv || 0);
  const repairs =
    Number(
      deal.repairs || 0
    );
  const price =
    Number(deal.price || 0);

  const mao =
    arv > 0
      ? arv * 0.7 -
        repairs
      : 0;

  const wholesale =
    mao - price;

  if (wholesale > 15000)
    return "Wholesale";

  if (
    arv > 0 &&
    price > 0
  )
    return "Flip";

  return "Buy & Hold";
}

export default function BuyerBlast({
  deal,
}) {
  const [copied, setCopied] =
    useState(false);

  const text = `🔥 New Deal Available

📍 ${deal.property_address}

💰 Asking: ${money(
    deal.price
  )}
🏡 ARV: ${money(
    deal.arv
  )}
🛠 Repairs: ${money(
    deal.repairs
  )}

📈 Strategy: ${getStrategy(
    deal
  )}

Reply if interested.`;

  async function copy() {
    await navigator.clipboard.writeText(
      text
    );

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
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
        Buyer Blast
      </h3>

      <textarea
        readOnly
        rows="9"
        value={text}
        style={{
          width: "100%",
          resize: "vertical",
        }}
      />

      <button
        onClick={copy}
        style={{
          marginTop: 10,
          width: "100%",
        }}
      >
        {copied
          ? "Copied!"
          : "Copy Blast Message"}
      </button>
    </div>
  );
}