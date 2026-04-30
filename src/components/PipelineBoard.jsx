import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { supabase } from "../supabaseClient";

const STAGES = [
  "New Lead",
  "Contacted",
  "Offer Sent",
  "Under Contract",
  "Closed",
];

export default function PipelineBoard({
  deals,
  openDeal,
  selectedIds,
  toggleSelect,
  refresh,
}) {
  async function onDragEnd(
    result
  ) {
    if (
      !result.destination
    )
      return;

    const dealId =
      result.draggableId;
    const newStage =
      result.destination
        .droppableId;

    const { error } =
      await supabase
        .from("deals")
        .update({
          stage: newStage,
        })
        .eq("id", dealId);

    if (error) {
      console.error(error);
      alert(
        "Could not move deal"
      );
    } else {
      refresh();
    }
  }

  return (
    <DragDropContext
      onDragEnd={
        onDragEnd
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {STAGES.map((stage) => {
          const rows =
            deals.filter(
              (deal) =>
                (deal.stage ||
                  "New Lead") ===
                stage
            );

          return (
            <Droppable
              droppableId={
                stage
              }
              key={stage}
            >
              {(provided) => (
                <div
                  ref={
                    provided.innerRef
                  }
                  {...provided.droppableProps}
                  style={{
                    background:
                      "#f8fafc",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                    minHeight: 400,
                  }}
                >
                  <h3
                    style={{
                      marginTop: 0,
                    }}
                  >
                    {stage} (
                    {
                      rows.length
                    }
                    )
                  </h3>

                  <div
                    style={{
                      display:
                        "grid",
                      gap: 10,
                    }}
                  >
                    {rows.map(
                      (
                        deal,
                        index
                      ) => {
                        const checked =
                          selectedIds.includes(
                            deal.id
                          );

                        return (
                          <Draggable
                            key={
                              deal.id
                            }
                            draggableId={String(
                              deal.id
                            )}
                            index={
                              index
                            }
                          >
                            {(
                              drag
                            ) => (
                              <div
                                ref={
                                  drag.innerRef
                                }
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                style={{
                                  background:
                                    "#fff",
                                  border:
                                    checked
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
                                    display:
                                      "flex",
                                    gap: 8,
                                    alignItems:
                                      "start",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      checked
                                    }
                                    onChange={() =>
                                      toggleSelect(
                                        deal.id
                                      )
                                    }
                                  />

                                  <div
                                    style={{
                                      flex: 1,
                                      cursor:
                                        "pointer",
                                    }}
                                    onClick={() =>
                                      openDeal(
                                        deal
                                      )
                                    }
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
                      }
                    )}

                    {
                      provided.placeholder
                    }
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