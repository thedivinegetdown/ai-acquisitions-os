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

export function getWorkspaceById(id) {
  return workspaceDefinitions.find((workspace) => workspace.id === id) || null;
}

export function getWorkspaceByRoute(route) {
  const normalizedRoute = normalizeWorkspaceRoute(route);
  return workspaceDefinitions.find((workspace) => workspace.route === normalizedRoute) || null;
}

export function normalizeWorkspaceRoute(route) {
  const cleanRoute = `/${String(route || "").replace(/^\/+/, "").split("?")[0].split("#")[0]}`;
  if (cleanRoute === "/" || cleanRoute === "") return "/today";
  return cleanRoute.replace(/\/+$/, "") || "/today";
}
