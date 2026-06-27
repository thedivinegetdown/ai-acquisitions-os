import { lazy, Suspense } from "react";
import AIInsights from "./AIInsights";
import OfferEngine from "./OfferEngine";
import LazyPanelFallback from "./LazyPanelFallback";

const ActivityTimeline = lazy(() => import("./ActivityTimeline"));
const BuyerBlast = lazy(() => import("./BuyerBlast"));
const BuyerMatches = lazy(() => import("./BuyerMatches"));
const CloseoutPanel = lazy(() => import("./CloseoutPanel"));
const CompsEngine = lazy(() => import("./CompsEngine"));
const DealAnalyzer = lazy(() => import("./DealAnalyzer"));
const DocumentContractPrepPanel = lazy(() => import("./DocumentContractPrepPanel"));
const DocumentVault = lazy(() => import("./DocumentVault"));
const MessageCenter = lazy(() => import("./MessageCenter"));
const NegotiationTracker = lazy(() => import("./NegotiationTracker"));
const SequenceEngine = lazy(() => import("./SequenceEngine"));
const TaskPanel = lazy(() => import("./TaskPanel"));
const TeamPanel = lazy(() => import("./TeamPanel"));

export default function DealModal({
  deal,
  close,
  refresh,
}) {
  if (!deal) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-modal-heading"
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: "min(1060px, calc(100vw - 32px))",
          borderRadius: 14,
          padding: 20,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          overflowX: "auto",
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        <h2 id="deal-modal-heading">{deal.property_address || "Deal"}</h2>

        <div style={{ lineHeight: 1.8, marginBottom: 16 }}>
          <div>
            <strong>ID:</strong>{" "}
            {deal.id ||
              deal.deal_id ||
              deal.lead_id ||
              deal.property_id ||
              "Not Found"}
          </div>

          <div>
            <strong>Lead Score:</strong>{" "}
            {deal.lead_score ?? "-"}
          </div>

          <div>
            <strong>Motivation:</strong>{" "}
            {deal.motivation ?? "-"}
          </div>

          <div>
            <strong>Stage:</strong>{" "}
            {deal.stage ?? "New Lead"}
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 12,
            }}
          >
            <div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Phone
              </div>
              <strong>
                {deal.phone || deal.seller_phone || deal.phone_number || "Unknown"}
              </strong>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const phone = deal.phone || deal.seller_phone || deal.phone_number;
                  if (phone && navigator.clipboard) {
                    navigator.clipboard.writeText(phone).catch(() => {});
                  }
                }}
                disabled={!deal.phone && !deal.seller_phone && !deal.phone_number}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #0f172a",
                  borderRadius: 8,
                  background:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "#0f172a"
                      : "#e5e7eb",
                  color:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "#ffffff"
                      : "#64748b",
                  cursor:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "pointer"
                      : "not-allowed",
                  fontWeight: 700,
                }}
              >
                {deal.phone || deal.seller_phone || deal.phone_number
                  ? "Copy Seller Phone"
                  : "No Phone Available"}
              </button>

              <a
                href={
                  deal.phone || deal.seller_phone || deal.phone_number
                    ? `tel:${(deal.phone || deal.seller_phone || deal.phone_number).replace(/[^+\d]/g, "")}`
                    : undefined
                }
                aria-disabled={
                  !(deal.phone || deal.seller_phone || deal.phone_number)
                }
                tabIndex={
                  deal.phone || deal.seller_phone || deal.phone_number
                    ? 0
                    : -1
                }
                style={{
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "8px 12px",
                  border: "1px solid #0f172a",
                  borderRadius: 8,
                  background:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "#0f172a"
                      : "#e5e7eb",
                  color:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "#ffffff"
                      : "#64748b",
                  cursor:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "pointer"
                      : "not-allowed",
                  fontWeight: 700,
                  textDecoration: "none",
                  pointerEvents:
                    deal.phone || deal.seller_phone || deal.phone_number
                      ? "auto"
                      : "none",
                }}
              >
                {deal.phone || deal.seller_phone || deal.phone_number
                  ? "Call Seller"
                  : "Call Disabled"}
              </a>
            </div>

            {!deal.phone && !deal.seller_phone && !deal.phone_number ? (
              <p style={{ color: "#64748b", margin: 0 }}>
                Seller phone is unavailable. Call shortcut is disabled.
              </p>
            ) : null}
          </div>
        </div>

        <AIInsights deal={deal} />

        <Suspense fallback={<LazyPanelFallback label="Loading comps..." />}>
          <CompsEngine
            deal={deal}
            refresh={refresh}
          />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading deal analyzer..." />}>
          <DealAnalyzer
            deal={deal}
            refresh={refresh}
          />
        </Suspense>

        <OfferEngine deal={deal} />

        <Suspense fallback={<LazyPanelFallback label="Loading document prep..." />}>
          <DocumentContractPrepPanel deal={deal} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading negotiation tracker..." />}>
          <NegotiationTracker
            deal={deal}
            refresh={refresh}
          />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading closeout..." />}>
          <CloseoutPanel
            deal={deal}
            refresh={refresh}
          />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading team panel..." />}>
          <TeamPanel
            deal={deal}
            refresh={refresh}
          />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading tasks..." />}>
          <TaskPanel
            deal={deal}
            refresh={refresh}
          />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading sequences..." />}>
          <SequenceEngine deal={deal} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading messages..." />}>
          <MessageCenter deal={deal} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading documents..." />}>
          <DocumentVault deal={deal} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading buyer matches..." />}>
          <BuyerMatches deal={deal} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading buyer blast..." />}>
          <BuyerBlast deal={deal} />
        </Suspense>

        <Suspense fallback={<LazyPanelFallback label="Loading activity timeline..." />}>
          <ActivityTimeline deal={deal} />
        </Suspense>

        <button
          type="button"
          onClick={close}
          aria-label="Close deal modal"
          style={{
            marginTop: 20,
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
