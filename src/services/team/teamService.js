import { safeTrim } from "../../utils/text";
import {
  buildPermissionMatrix,
  buildRoleDefinitions,
  getPermissionsForRole,
} from "./permissionService";
import { buildAssignmentSummary, normalizeAssignments } from "./assignmentService";

export const TEAM_STATUSES = ["Active", "Invited", "Inactive"];

export function buildInitialTeamMembers() {
  return [
    {
      id: "owner-local",
      name: "Team Owner",
      email: "",
      role: "Owner",
      status: "Active",
      assignedMarkets: "",
      assignedLeads: "",
      notes: "Local foundation record. Not persisted.",
    },
  ];
}

export function normalizeTeamMember(member = {}) {
  const assignments = normalizeAssignments(member);

  return {
    id: member.id || `member-${Date.now()}`,
    name: safeTrim(member.name),
    email: safeTrim(member.email),
    role: safeTrim(member.role) || "Viewer",
    status: safeTrim(member.status) || "Invited",
    assignedMarkets: assignments.assignedMarkets,
    assignedLeads: assignments.assignedLeads,
    notes: safeTrim(member.notes),
    permissions: getPermissionsForRole(member.role),
  };
}

function analyzeTeamRisks(teamMembers = []) {
  const normalizedMembers = teamMembers.map(normalizeTeamMember);
  const activeOwners = normalizedMembers.filter(
    (member) => member.role === "Owner" && member.status === "Active"
  );
  const missingEmail = normalizedMembers.filter((member) => !member.email);
  const inactiveAssignees = normalizedMembers.filter(
    (member) => member.status !== "Active" && member.assignedLeads.length > 0
  );

  return {
    missingData: [
      activeOwners.length === 0 ? "No active owner configured" : null,
      missingEmail.length > 0 ? "Some team members are missing emails" : null,
      normalizedMembers.length === 0 ? "No team members configured" : null,
    ].filter(Boolean),
    risks: [
      activeOwners.length === 0
        ? "At least one active Owner should exist before permissions are enforced."
        : null,
      inactiveAssignees.length > 0
        ? "Inactive or invited members have assigned leads."
        : null,
      missingEmail.length > 0
        ? "Missing emails will prevent future invitations and audit trails."
        : null,
    ].filter(Boolean),
  };
}

function getRecommendedNextAction({ risks, missingData }) {
  if (missingData.includes("No active owner configured")) {
    return "Assign one active Owner before enforcing permissions.";
  }

  if (missingData.includes("Some team members are missing emails")) {
    return "Add team member emails before invitation or audit workflows.";
  }

  if (risks.includes("Inactive or invited members have assigned leads.")) {
    return "Review lead assignments for inactive or invited members.";
  }

  return "Review the permission matrix before enabling enforcement.";
}

export function analyzeTeamFoundation(teamMembersInput = []) {
  const teamMembers = (teamMembersInput.length
    ? teamMembersInput
    : buildInitialTeamMembers()
  ).map(normalizeTeamMember);
  const roleDefinitions = buildRoleDefinitions();
  const permissionMatrix = buildPermissionMatrix();
  const assignmentSummary = buildAssignmentSummary(teamMembers);
  const riskAnalysis = analyzeTeamRisks(teamMembers);

  return {
    teamMembers,
    roleDefinitions,
    permissionMatrix,
    assignmentSummary,
    risks: riskAnalysis.risks,
    missingData: riskAnalysis.missingData,
    recommendedNextAction: getRecommendedNextAction(riskAnalysis),
    summary:
      "Team management foundation is configured for planning only. Permissions are visible but not enforced yet.",
    generatedAt: new Date().toISOString(),
  };
}
