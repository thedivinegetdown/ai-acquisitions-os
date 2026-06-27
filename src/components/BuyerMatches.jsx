import { useEffect, useState } from "react";
import { listBuyers } from "../services/repositories";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .trim();
}

export default function BuyerMatches({
  deal,
}) {
  const [buyers, setBuyers] =
    useState([]);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadBuyers();
  }, []);

  async function loadBuyers() {
    setLoading(true);

    const result = await listBuyers();

    if (!result.success) {
      console.error(result.error);
      setBuyers([]);
    } else {
      setBuyers(result.data || []);
    }

    setLoading(false);
  }

  const area =
    normalize(
      deal.property_address
    );

  const price =
    Number(
      deal.price || 0
    );

  const matches = buyers.filter(
    (buyer) => {
      const target =
        normalize(
          buyer.target_areas
        );

      const areaMatch =
        target === "" ||
        area.includes(target) ||
        target.includes(area);

      const max =
        Number(
          buyer.max_price || 0
        );

      const priceMatch =
        max === 0 ||
        price === 0 ||
        max >= price;

      return (
        areaMatch &&
        priceMatch
      );
    }
  );

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
        Buyer Matches
      </h3>

      {loading ? (
        <p>Loading buyers...</p>
      ) : matches.length === 0 ? (
        <p>
          No buyers matched
          yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {matches.map(
            (buyer) => (
              <div
                key={buyer.id}
                style={{
                  background:
                    "#ffffff",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: 6,
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

                <div
                  style={{
                    fontSize: 14,
                    color:
                      "#475569",
                    marginTop: 6,
                  }}
                >
                  Areas:{" "}
                  {buyer.target_areas ||
                    "Any"}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color:
                      "#475569",
                  }}
                >
                  Max Price:{" "}
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
                    : "Any"}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
