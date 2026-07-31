export const workspaceDefinitions = [
  {
    id: "today",
    label: "Today",
    route: "/today",
    icon: "home",
    ariaLabel: "Open Today workspace",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    route: "/pipeline",
    icon: "pipeline",
    ariaLabel: "Open Pipeline workspace",
  },
  {
    id: "inbox",
    label: "Inbox",
    route: "/inbox",
    icon: "inbox",
    ariaLabel: "Open Inbox workspace",
  },
  {
    id: "deals",
    label: "Deals",
    route: "/deals",
    icon: "deals",
    ariaLabel: "Open Deals workspace",
  },
  {
    id: "buyers",
    label: "Buyers",
    route: "/buyers",
    icon: "buyers",
    ariaLabel: "Open Buyers workspace",
    roles: ["owner", "admin", "dispositions", "manager"],
  },
  {
    id: "reports",
    label: "Reports",
    route: "/reports",
    icon: "reports",
    ariaLabel: "Open Reports workspace",
    roles: ["owner", "admin", "manager", "analyst"],
  },
  {
    id: "settings",
    label: "Settings",
    route: "/settings",
    icon: "settings",
    ariaLabel: "Open Settings workspace",
    roles: ["owner", "admin"],
  },
];

export const mobileWorkspaceIds = ["today", "pipeline", "inbox"];

export const DEAL_DECISION_ROOM_WORKSPACE_ID = "deal-decision-room";
export const APPROVAL_INBOX_WORKSPACE_ID = "approvals";

const contextualWorkspaceDefinitions = [
  {
    id: APPROVAL_INBOX_WORKSPACE_ID,
    label: "Approvals",
    route: "/approvals",
    icon: "inbox",
    ariaLabel: "Open Universal Approval Inbox",
    parentId: "today",
  },
];

export function getWorkspaceById(id) {
  return (
    [...workspaceDefinitions, ...contextualWorkspaceDefinitions].find(
      (workspace) => workspace.id === id
    ) || null
  );
}

export function getWorkspaceByRoute(route) {
  const normalizedRoute = normalizeWorkspaceRoute(route);
  if (isDealDecisionRoomRoute(normalizedRoute)) {
    return {
      id: DEAL_DECISION_ROOM_WORKSPACE_ID,
      label: "Deal Decision Room",
      route: normalizedRoute,
      icon: "deals",
      ariaLabel: "Open Deal Decision Room",
      parentId: "deals",
    };
  }

  return (
    [...workspaceDefinitions, ...contextualWorkspaceDefinitions].find(
      (workspace) => workspace.route === normalizedRoute
    ) || null
  );
}

export function normalizeWorkspaceRoute(route) {
  const cleanRoute = `/${String(route || "").replace(/^\/+/, "").split("?")[0].split("#")[0]}`;
  if (cleanRoute === "/" || cleanRoute === "") return "/today";
  return cleanRoute.replace(/\/+$/, "") || "/today";
}

export function getDealRoute(dealId) {
  return `/deals/${encodeURIComponent(String(dealId || ""))}`;
}

export function getDealIdFromRoute(route) {
  const normalizedRoute = normalizeWorkspaceRoute(route);
  const match = normalizedRoute.match(/^\/deals\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function isDealDecisionRoomRoute(route) {
  return Boolean(getDealIdFromRoute(route));
}
