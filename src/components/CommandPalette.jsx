import { useEffect, useMemo, useState } from "react";

export default function CommandPalette({
  deals,
  openDeal,
  setFilteredDeals,
}) {
  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  useEffect(() => {
    function handleKey(e) {
      const isK =
        e.key.toLowerCase() ===
        "k";

      if (
        (e.ctrlKey ||
          e.metaKey) &&
        isK
      ) {
        e.preventDefault();
        setOpen(true);
      }

      if (
        e.key === "Escape"
      ) {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKey
      );
  }, []);

  const commands =
    useMemo(() => {
      const base = [
        {
          label:
            "Show All Deals",
          run: () =>
            setFilteredDeals(
              deals
            ),
        },
        {
          label:
            "Show Hot Leads",
          run: () =>
            setFilteredDeals(
              deals.filter(
                (d) =>
                  Number(
                    d.lead_score ||
                      0
                  ) >= 8 &&
                  Number(
                    d.motivation ||
                      0
                  ) >= 8
              )
            ),
        },
        {
          label:
            "Show Overdue",
          run: () => {
            const today =
              new Date()
                .toISOString()
                .slice(
                  0,
                  10
                );

            setFilteredDeals(
              deals.filter(
                (d) =>
                  d.due_date &&
                  d.due_date <
                    today
              )
            );
          },
        },
        {
          label:
            "Show Closed Deals",
          run: () =>
            setFilteredDeals(
              deals.filter(
                (d) =>
                  d.stage ===
                  "Closed"
              )
            ),
        },
      ];

      const dealCommands =
        deals.map(
          (deal) => ({
            label: `Open: ${deal.property_address}`,
            run: () =>
              openDeal(
                deal
              ),
          })
        );

      return [
        ...base,
        ...dealCommands,
      ];
    }, [
      deals,
      openDeal,
      setFilteredDeals,
    ]);

  const results =
    commands.filter(
      (cmd) =>
        cmd.label
          .toLowerCase()
          .includes(
            query.toLowerCase()
          )
    );

  if (!open) return null;

  return (
    <div
      onClick={() =>
        setOpen(false)
      }
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(0,0,0,0.45)",
        zIndex: 99999,
        display: "flex",
        justifyContent:
          "center",
        alignItems:
          "start",
        paddingTop: 80,
      }}
    >
      <div
        onClick={(e) =>
          e.stopPropagation()
        }
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <input
          autoFocus
          placeholder="Type a command..."
          value={query}
          onChange={(e) =>
            setQuery(
              e.target.value
            )
          }
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            padding: 18,
            fontSize: 18,
            borderBottom:
              "1px solid #e5e7eb",
            boxSizing:
              "border-box",
          }}
        />

        <div
          style={{
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {results.length ===
          0 ? (
            <div
              style={{
                padding: 18,
                color:
                  "#64748b",
              }}
            >
              No results
            </div>
          ) : (
            results.map(
              (
                item,
                index
              ) => (
                <div
                  key={index}
                  onClick={() => {
                    item.run();
                    setOpen(
                      false
                    );
                    setQuery(
                      ""
                    );
                  }}
                  style={{
                    padding: 16,
                    cursor:
                      "pointer",
                    borderBottom:
                      "1px solid #f1f5f9",
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}