import { safeTrim } from "../../utils/text";

export const DEFAULT_ORGANIZATION_ID = "local-org";
export const DEFAULT_TENANT_ID = "local-tenant";

export function buildDefaultOrganization() {
  return {
    id: DEFAULT_ORGANIZATION_ID,
    tenantId: DEFAULT_TENANT_ID,
    name: "Local Organization",
    activeMarket: "",
    settings: {
      timezone: "America/New_York",
      aiAssistanceEnabled: true,
    },
  };
}

export function normalizeOrganization(organization = {}) {
  const fallback = buildDefaultOrganization();

  return {
    id: safeTrim(organization.id) || fallback.id,
    tenantId: safeTrim(organization.tenantId || organization.tenant_id) || fallback.tenantId,
    name: safeTrim(organization.name || organization.organizationName) || fallback.name,
    activeMarket: safeTrim(organization.activeMarket || organization.defaultMarket),
    settings: {
      ...fallback.settings,
      ...(organization.settings || {}),
    },
  };
}

export function getOrganizationId(contextOrRecord = {}) {
  return (
    contextOrRecord.organizationId ||
    contextOrRecord.organization_id ||
    contextOrRecord.organization?.id ||
    DEFAULT_ORGANIZATION_ID
  );
}
