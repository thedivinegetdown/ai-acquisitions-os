import { useMemo, useState } from "react";
import {
  PERMISSIONS,
  TEAM_ROLES,
  TEAM_STATUSES,
  analyzeTeamFoundation,
  buildInitialTeamMembers,
} from "../services/team";

const fieldStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 10,
  width: "100%",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
};

function Field({ label, children }) {
  return (
    <label>
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function DetailList({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div style={cardStyle}>
      <strong>{title}</strong>
      {safeItems.length === 0 ? (
        <p style={{ marginBottom: 0 }}>{emptyText}</p>
      ) : (
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          {safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

export default function TeamRolesPanel() {
  const [teamMembers, setTeamMembers] = useState(() => buildInitialTeamMembers());
  const analysis = useMemo(
    () => analyzeTeamFoundation(teamMembers),
    [teamMembers]
  );

  function updateMember(id, field, value) {
    setTeamMembers((current) =>
      current.map((member) =>
        member.id === id
          ? {
              ...member,
              [field]: value,
            }
          : member
      )
    );
  }

  function addMember() {
    setTeamMembers((current) => [
      ...current,
      {
        id: `member-${Date.now()}`,
        name: "",
        email: "",
        role: "Viewer",
        status: "Invited",
        assignedMarkets: "",
        assignedLeads: "",
        notes: "",
      },
    ]);
  }

  return (
    <section
      style={{
        background: "#f8fafc",
        border: "1px solid #dbe3ef",
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
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
            Team / Roles
          </div>
          <strong style={{ color: "#0f172a", fontSize: 22 }}>
            Team Management Foundation
          </strong>
        </div>

        <span
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 999,
            color: "#1d4ed8",
            fontSize: 13,
            fontWeight: 800,
            padding: "7px 12px",
          }}
        >
          Team management foundation - permissions are not fully enforced yet.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 12,
        }}
      >
        <MetricCard label="Team Members" value={analysis.teamMembers.length} />
        <MetricCard
          label="Active Members"
          value={analysis.assignmentSummary.activeMembers}
        />
        <MetricCard
          label="Assigned Leads"
          value={analysis.assignmentSummary.totalAssignedLeads}
        />
        <MetricCard
          label="Market Coverage"
          value={analysis.assignmentSummary.marketCoverage.length}
        />
      </div>

      <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
        {teamMembers.map((member) => (
          <div key={member.id} style={cardStyle}>
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <Field label="Name">
                <input
                  value={member.name}
                  onChange={(event) =>
                    updateMember(member.id, "name", event.target.value)
                  }
                  style={fieldStyle}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    updateMember(member.id, "email", event.target.value)
                  }
                  style={fieldStyle}
                />
              </Field>
              <Field label="Role">
                <select
                  value={member.role}
                  onChange={(event) =>
                    updateMember(member.id, "role", event.target.value)
                  }
                  style={fieldStyle}
                >
                  {TEAM_ROLES.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={member.status}
                  onChange={(event) =>
                    updateMember(member.id, "status", event.target.value)
                  }
                  style={fieldStyle}
                >
                  {TEAM_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned Markets">
                <input
                  value={member.assignedMarkets}
                  onChange={(event) =>
                    updateMember(member.id, "assignedMarkets", event.target.value)
                  }
                  placeholder="Phoenix, Tucson"
                  style={fieldStyle}
                />
              </Field>
              <Field label="Assigned Leads">
                <input
                  value={member.assignedLeads}
                  onChange={(event) =>
                    updateMember(member.id, "assignedLeads", event.target.value)
                  }
                  placeholder="Lead IDs, comma separated"
                  style={fieldStyle}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={member.notes}
                onChange={(event) =>
                  updateMember(member.id, "notes", event.target.value)
                }
                rows={2}
                style={{ ...fieldStyle, marginTop: 10, resize: "vertical" }}
              />
            </Field>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMember}
        style={{
          border: "1px solid #0f172a",
          background: "#0f172a",
          borderRadius: 8,
          color: "#ffffff",
          cursor: "pointer",
          fontWeight: 800,
          marginBottom: 12,
          padding: "10px 14px",
        }}
      >
        Add Team Member
      </button>

      <div
        style={{
          ...cardStyle,
          marginBottom: 12,
          overflowX: "auto",
        }}
      >
        <strong>Permission Matrix</strong>
        <table
          style={{
            borderCollapse: "collapse",
            minWidth: 820,
            marginTop: 10,
            width: "100%",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Role</th>
              {PERMISSIONS.map((permission) => (
                <th key={permission.key} style={{ textAlign: "left", padding: 8 }}>
                  {permission.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.roleDefinitions.map((definition) => (
              <tr key={definition.role}>
                <td style={{ borderTop: "1px solid #e5e7eb", padding: 8 }}>
                  <strong>{definition.role}</strong>
                </td>
                {PERMISSIONS.map((permission) => (
                  <td
                    key={permission.key}
                    style={{ borderTop: "1px solid #e5e7eb", padding: 8 }}
                  >
                    {definition.permissions[permission.key] ? "Yes" : "No"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 12,
        }}
      >
        <DetailList
          title="Risks"
          items={analysis.risks}
          emptyText="No team risks identified."
        />
        <DetailList
          title="Missing Data"
          items={analysis.missingData}
          emptyText="No missing data identified."
        />
      </div>

      <div style={cardStyle}>
        <strong>Recommended Next Action</strong>
        <p style={{ color: "#334155", marginBottom: 6 }}>
          {analysis.recommendedNextAction}
        </p>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {analysis.summary} Existing access is not blocked by this foundation.
        </div>
      </div>
    </section>
  );
}
