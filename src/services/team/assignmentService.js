import { safeTrim } from "../../utils/text";

function splitValues(value) {
  if (Array.isArray(value)) return value.map(safeTrim).filter(Boolean);
  return String(value || "")
    .split(",")
    .map(safeTrim)
    .filter(Boolean);
}

export function normalizeAssignments(member = {}) {
  return {
    assignedMarkets: splitValues(member.assignedMarkets),
    assignedLeads: splitValues(member.assignedLeads),
  };
}

export function buildAssignmentSummary(teamMembers = []) {
  const activeMembers = teamMembers.filter((member) => member.status === "Active");
  const totalAssignedLeads = teamMembers.reduce(
    (sum, member) => sum + normalizeAssignments(member).assignedLeads.length,
    0
  );
  const uncoveredMembers = activeMembers.filter(
    (member) =>
      normalizeAssignments(member).assignedMarkets.length === 0 &&
      normalizeAssignments(member).assignedLeads.length === 0
  );

  return {
    activeMembers: activeMembers.length,
    totalAssignedLeads,
    uncoveredMembers: uncoveredMembers.map((member) => member.name || member.email),
    marketCoverage: [
      ...new Set(
        teamMembers.flatMap((member) => normalizeAssignments(member).assignedMarkets)
      ),
    ],
  };
}
