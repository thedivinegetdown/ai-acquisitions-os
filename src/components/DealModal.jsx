import DealAnalyzer from "./DealAnalyzer";
import TaskPanel from "./TaskPanel";
import ActivityTimeline from "./ActivityTimeline";
import AIInsights from "./AIInsights";
import BuyerMatches from "./BuyerMatches";
import BuyerBlast from "./BuyerBlast";
import OfferEngine from "./OfferEngine";
import NegotiationTracker from "./NegotiationTracker";
import CloseoutPanel from "./CloseoutPanel";
import CompsEngine from "./CompsEngine";
import DocumentVault from "./DocumentVault";
import TeamPanel from "./TeamPanel";
import SequenceEngine from "./SequenceEngine";
import MessageCenter from "./MessageCenter";

export default function DealModal({
  deal,
  close,
  refresh,
}) {
  if (!deal) return null;

  // Debug live deal object
  console.log("DEAL MODAL DATA:", deal);

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
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: 1060,
          borderRadius: 14,
          padding: 20,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2>{deal.property_address || "Deal"}</h2>

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
        </div>

        <AIInsights deal={deal} />

        <CompsEngine
          deal={deal}
          refresh={refresh}
        />

        <DealAnalyzer
          deal={deal}
          refresh={refresh}
        />

        <OfferEngine deal={deal} />

        <NegotiationTracker
          deal={deal}
          refresh={refresh}
        />

        <CloseoutPanel
          deal={deal}
          refresh={refresh}
        />

        <TeamPanel
          deal={deal}
          refresh={refresh}
        />

        <TaskPanel
          deal={deal}
          refresh={refresh}
        />

        <SequenceEngine deal={deal} />

        <MessageCenter deal={deal} />

        <DocumentVault deal={deal} />

        <BuyerMatches deal={deal} />

        <BuyerBlast deal={deal} />

        <ActivityTimeline deal={deal} />

        <button
          onClick={close}
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