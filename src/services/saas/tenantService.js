import {
  DEFAULT_TENANT_ID,
  getOrganizationId,
  normalizeOrganization,
} from "./organizationContextService";
import { getCurrentRole, normalizeUser } from "./userContextService";

export function getTenantId(contextOrRecord = {}) {
  return (
    contextOrRecord.tenantId ||
    contextOrRecord.tenant_id ||
    contextOrRecord.organization?.tenantId ||
    DEFAULT_TENANT_ID
  );
}

export function buildTenantContext({
  organization,
  user,
  activeMarket,
} = {}) {
  const currentOrganization = normalizeOrganization(organization);
  const currentUser = normalizeUser(user);

  return {
    tenantId: currentOrganization.tenantId || DEFAULT_TENANT_ID,
    organizationId: currentOrganization.id,
    organization: currentOrganization,
    user: currentUser,
    currentRole: currentUser.role,
    activeMarket: activeMarket || currentOrganization.activeMarket || "",
    enforcementActive: false,
    generatedAt: new Date().toISOString(),
  };
}

export function isTenantScoped(record = {}) {
  return Boolean(
    record.tenantId ||
      record.tenant_id ||
      record.organizationId ||
      record.organization_id
  );
}

export function createTenantScopedPayload(payload = {}, context = {}) {
  return {
    ...payload,
    tenant_id: getTenantId(context),
    organization_id: getOrganizationId(context),
  };
}

export function applyTenantScope(records = [], context = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const tenantId = getTenantId(context);
  const organizationId = getOrganizationId(context);

  return safeRecords.filter((record) => {
    if (!isTenantScoped(record)) return true;

    return (
      getTenantId(record) === tenantId &&
      getOrganizationId(record) === organizationId
    );
  });
}

export function analyzeTenantReadiness(context = {}) {
  const tenantContext = buildTenantContext(context);
  const missingData = [
    tenantContext.tenantId === DEFAULT_TENANT_ID ? "Tenant ID is placeholder" : null,
    tenantContext.organizationId === "local-org"
      ? "Organization ID is placeholder"
      : null,
    !tenantContext.organization.name ? "Organization name" : null,
    !tenantContext.user.email ? "Current user email" : null,
    !tenantContext.activeMarket ? "Active market" : null,
  ].filter(Boolean);
  const risks = [
    "Tenant enforcement is not globally active yet.",
    missingData.length > 0
      ? "SaaS context still depends on local placeholders."
      : null,
  ].filter(Boolean);

  return {
    tenantContext,
    tenantReadinessStatus:
      missingData.length === 0 ? "Ready for schema planning" : "Foundation only",
    missingData,
    risks,
    recommendedNextAction:
      missingData.length > 0
        ? "Replace local placeholders with persisted organization and user context before enforcing tenant isolation."
        : "Plan tenant-scoped database schema and RLS policies before enabling enforcement.",
    summary:
      "SaaS foundation only. Tenant helpers are available, but tenant enforcement is not fully active yet.",
    generatedAt: new Date().toISOString(),
  };
}

export { getCurrentRole, getOrganizationId };
