import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { memo, useCallback, useMemo } from "react";
import { sendOutboundSms } from "../services/sms";
import { updateDeal } from "../services/repositories";

const STAGES = [
  "New Lead",
  "Contacted",
  "Offer Sent",
  "Under Contract",
  "Closed",
];

function PipelineBoard({
  deals,
  openDeal,
  selectedIds,
  toggleSelect,
  refresh,
}) {
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dealsByStage = useMemo(() => {
    return STAGES.reduce((groups, stage) => {
      groups[stage] = [];
      return groups;
    }, {});
  }, []);

  const stagedDeals = useMemo(() => {
    const groups = STAGES.reduce((nextGroups, stage) => {
      nextGroups[stage] = [];
      return nextGroups;
    }, {});

    deals.forEach((deal) => {
      const stage = deal.stage || "New Lead";
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(deal);
    });

    return {
      ...dealsByStage,
      ...groups,
    };
  }, [deals, dealsByStage]);

  const onDragEnd = useCallback(async (result) => {
    if (!result.destination) return;

    const deal = deals.find(
      (d) => String(d.id) === result.draggableId
    );

    if (!deal) return;

    const newStage = result.destination.droppableId;
    const previousStage = deal.stage || "New Lead";

    // If no change, do nothing
    if (newStage === previousStage) return;

    // 🔁 Update stage in Supabase
    const updateResult = await updateDeal(deal.id, { stage: newStage });

    if (!updateResult.success) {
      console.error(updateResult.error);
      alert("Could not move deal");
      return;
    }

    // 🔥 AUTO SMS WHEN MOVED TO CONTACTED
    if (
      newStage === "Contacted" &&
      previousStage !== "Contacted"
    ) {
      try {
        await sendOutboundSms({
          to: deal.phone,
          message: `Hi, I'm reaching out about ${
            deal.property_address || "your property"
          }. Would you consider an offer?`,
          dealId: deal.id,
        });
      } catch (err) {
        console.error("[AUTO SMS ERROR]", err);
      }
    }

    // Refresh UI
    refresh();
  }, [deals, refresh]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 16,
          width: "100%",
          minWidth: 0,
        }}
      >
        {STAGES.map((stage) => {
          const rows = stagedDeals[stage] || [];

          return (
            <Droppable
              droppableId={stage}
              key={stage}
            >
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                    minHeight: 400,
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {stage} ({rows.length})
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {rows.map((deal, index) => {
                      const checked =
                        selectedIdSet.has(deal.id);

                      return (
                        <Draggable
                          key={deal.id}
                          draggableId={String(
                            deal.id
                          )}
                          index={index}
                        >
                          {(drag) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              style={{
                                background: "#fff",
                                border: checked
                                  ? "2px solid #0f172a"
                                  : "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: 12,
                                ...drag
                                  .draggableProps
                                  .style,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems:
                                    "start",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  aria-label={`Select deal ${deal.property_address || deal.id}`}
                                  onChange={() =>
                                    toggleSelect(
                                      deal.id
                                    )
                                  }
                                />

                                <div
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      openDeal(deal);
                                    }
                                  }}
                                  style={{
                                    flex: 1,
                                    cursor: "pointer",
                                  }}
                                  onClick={() =>
                                    openDeal(deal)
                                  }
                                  aria-label={`Open deal ${deal.property_address || deal.id}`}
                                >
                                  <div
                                    style={{
                                      fontWeight: 800,
                                    }}
                                  >
                                    {
                                      deal.property_address
                                    }
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 14,
                                      color:
                                        "#475569",
                                      marginTop: 6,
                                    }}
                                  >
                                    Score:{" "}
                                    {deal.lead_score ??
                                      "-"}{" "}
                                    • Mot:{" "}
                                    {deal.motivation ??
                                      "-"}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 13,
                                      color:
                                        "#64748b",
                                      marginTop: 4,
                                    }}
                                  >
                                    Owner:{" "}
                                    {deal.owner_name ||
                                      "Unassigned"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}

                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

export default memo(PipelineBoard);
