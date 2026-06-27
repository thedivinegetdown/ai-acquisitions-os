import { useEffect, useState } from "react";
import { loadThreadMessages } from "../../../services/conversations";
import { useWorkflowEngine } from "../hooks/useWorkflowEngine";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
};

function MetricCard({ label, value }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function WorkflowList({ title, workflows, emptyText }) {
  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {workflows.length === 0 ? (
        <p style={{ color: "#64748b", marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {workflows.slice(0, 5).map((workflow) => (
            <div key={`${title}-${workflow.id}`}>
              <strong>{workflow.name}</strong>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                {workflow.priority} - {workflow.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkflowDashboardPanel({
  deal,
  selectedPhone,
  refreshKey,
}) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }

    loadMessages();
  }, [selectedPhone, refreshKey]);

  async function loadMessages() {
    const result = await loadThreadMessages(selectedPhone);

    if (!result.success) {
      console.error("[WorkflowDashboardPanel] Message load failed:", result.error);
      setMessages([]);
      return;
    }

    setMessages(result.data);
  }

  const workflows = useWorkflowEngine({ deal, messages });

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 18,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            AI Workflow Engine
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Workflow Orchestration
          </strong>
        </div>
        <span
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 999,
            color: "#9a3412",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Approval required - no actions execute automatically.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard label="Active Workflows" value={workflows.activeWorkflows.length} />
        <MetricCard label="Pending Approvals" value={workflows.pendingApprovals.length} />
        <MetricCard label="Blocked Workflows" value={workflows.blockedWorkflows.length} />
        <MetricCard
          label="Completed Recently"
          value={workflows.recentlyCompletedWorkflows.length}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <WorkflowList
          title="Active Workflows"
          workflows={workflows.activeWorkflows}
          emptyText="No active workflows."
        />
        <WorkflowList
          title="Blocked Workflows"
          workflows={workflows.blockedWorkflows}
          emptyText="No blocked workflows."
        />
        <WorkflowList
          title="Suggested Next Workflows"
          workflows={workflows.suggestedNextWorkflows}
          emptyText="No suggestions yet."
        />
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <strong>Approval Queue</strong>
        {workflows.pendingApprovals.length === 0 ? (
          <p style={{ color: "#64748b", marginBottom: 0 }}>No approvals pending.</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {workflows.pendingApprovals.map((approval) => (
              <div key={approval.id}>
                <strong>{approval.workflowName}</strong>
                <div style={{ color: "#334155", marginTop: 4 }}>{approval.action}</div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {["Approved", "Rejected", "Edited", "Postponed"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => workflows.setApprovalStatus(approval.id, status)}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        background:
                          approval.status === status ? "#0f172a" : "#ffffff",
                        color:
                          approval.status === status ? "#ffffff" : "#0f172a",
                        cursor: "pointer",
                        padding: "6px 8px",
                      }}
                    >
                      {status.replace("ed", "e")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div style={cardStyle}>
          <strong>Workflow Timeline</strong>
          <div style={{ color: "#334155", marginTop: 8 }}>
            Current: {workflows.timeline.currentStep?.action || "None"}
          </div>
          <div style={{ color: "#334155", marginTop: 4 }}>
            Next: {workflows.timeline.nextRecommendedStep?.action || "None"}
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
            Overdue steps: {workflows.timeline.overdueSteps.length}
          </div>
        </div>

        <div style={cardStyle}>
          <strong>Workflow History</strong>
          {workflows.history.length === 0 ? (
            <p style={{ color: "#64748b", marginBottom: 0 }}>No workflow history.</p>
          ) : (
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              {workflows.history.slice(0, 5).map((item) => (
                <li key={item.workflowId}>
                  {item.workflowId}: {item.latestAction}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
