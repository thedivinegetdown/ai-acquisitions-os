export const TEAM_ROLES = [
  "Owner",
  "Admin",
  "Acquisitions Manager",
  "Dispositions Manager",
  "Transaction Coordinator",
  "Viewer",
];

export const PERMISSIONS = [
  { key: "canViewLeads", label: "Can view leads" },
  { key: "canEditLeads", label: "Can edit leads" },
  { key: "canSendMessages", label: "Can send messages" },
  { key: "canCreateOffers", label: "Can create offers" },
  { key: "canManageBuyers", label: "Can manage buyers" },
  { key: "canManageTransactions", label: "Can manage transactions" },
  { key: "canViewDashboard", label: "Can view dashboard" },
  { key: "canManageSettings", label: "Can manage settings" },
];

const ROLE_PERMISSION_MAP = {
  Owner: {
    canViewLeads: true,
    canEditLeads: true,
    canSendMessages: true,
    canCreateOffers: true,
    canManageBuyers: true,
    canManageTransactions: true,
    canViewDashboard: true,
    canManageSettings: true,
  },
  Admin: {
    canViewLeads: true,
    canEditLeads: true,
    canSendMessages: true,
    canCreateOffers: true,
    canManageBuyers: true,
    canManageTransactions: true,
    canViewDashboard: true,
    canManageSettings: true,
  },
  "Acquisitions Manager": {
    canViewLeads: true,
    canEditLeads: true,
    canSendMessages: true,
    canCreateOffers: true,
    canManageBuyers: false,
    canManageTransactions: false,
    canViewDashboard: true,
    canManageSettings: false,
  },
  "Dispositions Manager": {
    canViewLeads: true,
    canEditLeads: false,
    canSendMessages: true,
    canCreateOffers: false,
    canManageBuyers: true,
    canManageTransactions: false,
    canViewDashboard: true,
    canManageSettings: false,
  },
  "Transaction Coordinator": {
    canViewLeads: true,
    canEditLeads: true,
    canSendMessages: false,
    canCreateOffers: false,
    canManageBuyers: false,
    canManageTransactions: true,
    canViewDashboard: true,
    canManageSettings: false,
  },
  Viewer: {
    canViewLeads: true,
    canEditLeads: false,
    canSendMessages: false,
    canCreateOffers: false,
    canManageBuyers: false,
    canManageTransactions: false,
    canViewDashboard: true,
    canManageSettings: false,
  },
};

export function buildRoleDefinitions() {
  return TEAM_ROLES.map((role) => ({
    role,
    permissions: {
      ...ROLE_PERMISSION_MAP[role],
    },
  }));
}

export function buildPermissionMatrix() {
  return TEAM_ROLES.reduce((matrix, role) => {
    matrix[role] = {
      ...ROLE_PERMISSION_MAP[role],
    };
    return matrix;
  }, {});
}

export function getPermissionsForRole(role) {
  return {
    ...(ROLE_PERMISSION_MAP[role] || ROLE_PERMISSION_MAP.Viewer),
  };
}
