function money(value) {
  const num = Number(value || 0);

  return num.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  );
}

export default function OfferEngine({
  deal,
}) {
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

  const cashOffer =
    mao;

  const wholesaleTarget =
    mao - 10000;

  const creativeDown =
    price > 0
      ? price * 0.1
      : 0;

  const creativePayment =
    price > 0
      ? price * 0.0065
      : 0;

  const sellerFinance =
    price > 0
      ? `Offer ${money(
          creativeDown
        )} down and ${money(
          creativePayment
        )}/mo`
      : "Enter purchase price";

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
        Offer Engine
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <strong>
            Cash Offer
          </strong>
          <div
            style={{
              marginTop: 8,
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {money(
              cashOffer
            )}
          </div>
        </div>

        <div
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <strong>
            Wholesale Target
          </strong>
          <div
            style={{
              marginTop: 8,
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {money(
              wholesaleTarget
            )}
          </div>
        </div>

        <div
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <strong>
            Seller Finance
          </strong>

          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            {sellerFinance}
          </div>
        </div>
      </div>
    </div>
  );
}