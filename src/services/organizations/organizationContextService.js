import { getValidatedUser } from "../auth";
import { listCurrentUserMemberships } from "../repositories/organizationRepository";

const OWNERSHIP_FIELDS = new Set([
  "organization_id",
  "organizationId",
  "tenant_id",
  "tenantId",
]);

export async function requireActiveOrganizationContext() {
  const { user, error } = await getValidatedUser();

  if (error || !user?.id) {
    throw error || new Error("An authenticated user is required.");
  }

  const membershipResult = await listCurrentUserMemberships(user.id);
  if (!membershipResult.success) {
    throw membershipResult.error?.cause || new Error(membershipResult.error?.message);
  }

  const memberships = membershipResult.data || [];
  if (memberships.length === 0) {
    throw new Error("No active organization membership is available.");
  }

  const membership = memberships[0];
  return {
    organizationId: membership.organization_id,
    userId: user.id,
    role: membership.role,
    status: membership.status,
    organization: membership.organization || null,
    warning:
      memberships.length > 1
        ? "Multiple active memberships found; using the first organization ID deterministically."
        : null,
  };
}

export async function addCurrentOrganizationOwnership(payload = {}) {
  const context = await requireActiveOrganizationContext();
  return {
    ...stripOrganizationOwnership(payload),
    organization_id: context.organizationId,
  };
}

export function stripOrganizationOwnership(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !OWNERSHIP_FIELDS.has(key))
  );
}
