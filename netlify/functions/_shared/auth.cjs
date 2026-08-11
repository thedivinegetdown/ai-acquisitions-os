const { createClient } = require("@supabase/supabase-js");
const { json, safeTrim } = require("./security.cjs");

const MEMBERSHIP_ROLES = Object.freeze(["owner", "admin", "analyst", "viewer"]);
const MUTATION_ROLES = Object.freeze(["owner", "admin", "analyst"]);

function headerValue(event, name) {
  const target = name.toLowerCase();
  const entry = Object.entries(event?.headers || {}).find(
    ([key]) => key.toLowerCase() === target
  );
  return safeTrim(entry?.[1]);
}

function bearerToken(event) {
  const authorization = headerValue(event, "authorization");
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || "";
}

function createServerClients({ env = process.env, createClientImpl = createClient } = {}) {
  const url = safeTrim(env.SUPABASE_URL);
  const anonKey = safeTrim(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY);
  const serviceRoleKey = safeTrim(env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !anonKey || !serviceRoleKey) return null;

  const clientOptions = {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };

  return {
    authClient: createClientImpl(url, anonKey, clientOptions),
    adminClient: createClientImpl(url, serviceRoleKey, clientOptions),
  };
}

function unauthorized(message = "Authentication required.") {
  return json(401, { success: false, error: message });
}

function forbidden(message = "Organization access denied.") {
  return json(403, { success: false, error: message });
}

function serverUnavailable() {
  return json(503, {
    success: false,
    error: "Authentication service is unavailable.",
  });
}

function resolveRequestedOrganizationId(event, explicitOrganizationId) {
  const headerOrganizationId = headerValue(event, "x-organization-id");
  const bodyOrganizationId = safeTrim(explicitOrganizationId);

  if (
    headerOrganizationId &&
    bodyOrganizationId &&
    headerOrganizationId !== bodyOrganizationId
  ) {
    return { error: forbidden("Conflicting organization scope.") };
  }

  return { organizationId: headerOrganizationId || bodyOrganizationId || "" };
}

async function requireAuthenticatedRequest(event, { clients } = {}) {
  const token = bearerToken(event);
  if (!token) return { response: unauthorized() };

  const serverClients = clients || createServerClients();
  if (!serverClients) return { response: serverUnavailable() };

  try {
    const { data, error } = await serverClients.authClient.auth.getUser(token);
    if (error || !data?.user?.id) {
      return { response: unauthorized("Invalid or expired authentication.") };
    }

    return {
      auth: {
        authenticated: true,
        userId: data.user.id,
        email: data.user.email || null,
      },
      clients: serverClients,
    };
  } catch {
    return { response: unauthorized("Invalid or expired authentication.") };
  }
}

async function requireTenantContext(
  event,
  {
    allowedRoles = MEMBERSHIP_ROLES,
    clients,
    requestedOrganizationId = "",
  } = {}
) {
  const authenticated = await requireAuthenticatedRequest(event, { clients });
  if (authenticated.response) return authenticated;

  const requested = resolveRequestedOrganizationId(
    event,
    requestedOrganizationId
  );
  if (requested.error) return { response: requested.error };

  try {
    let query = authenticated.clients.adminClient
      .from("organization_memberships")
      .select(
        "organization_id, role, status, organization:organizations!organization_memberships_organization_id_fkey!inner(status)"
      )
      .eq("user_id", authenticated.auth.userId)
      .eq("status", "active")
      .eq("organization.status", "active")
      .order("organization_id", { ascending: true });

    query = requested.organizationId
      ? query.eq("organization_id", requested.organizationId).limit(1)
      : query.limit(2);

    const { data, error } = await query;
    if (error) return { response: serverUnavailable() };

    const memberships = (data || []).filter((membership) =>
      MEMBERSHIP_ROLES.includes(membership.role)
    );

    if (memberships.length === 0) return { response: forbidden() };
    if (!requested.organizationId && memberships.length > 1) {
      return {
        response: forbidden("Explicit organization selection is required."),
      };
    }

    const membership = memberships[0];
    if (!allowedRoles.includes(membership.role)) {
      return { response: forbidden("Insufficient organization role.") };
    }

    return {
      context: {
        authenticated: true,
        userId: authenticated.auth.userId,
        email: authenticated.auth.email,
        organizationId: membership.organization_id,
        role: membership.role,
        membershipStatus: membership.status,
      },
      clients: authenticated.clients,
    };
  } catch {
    return { response: serverUnavailable() };
  }
}

async function requireDealInOrganization(adminClient, dealId, organizationId) {
  if (!safeTrim(dealId)) return { deal: null };

  try {
    const { data, error } = await adminClient
      .from("deals")
      .select("id, organization_id")
      .eq("id", dealId)
      .eq("organization_id", organizationId)
      .limit(1);

    if (error) return { response: serverUnavailable() };
    if (!data?.[0]) {
      return {
        response: json(404, { success: false, error: "Resource not found." }),
      };
    }

    return { deal: data[0] };
  } catch {
    return { response: serverUnavailable() };
  }
}

module.exports = {
  MEMBERSHIP_ROLES,
  MUTATION_ROLES,
  bearerToken,
  createServerClients,
  requireAuthenticatedRequest,
  requireDealInOrganization,
  requireTenantContext,
  resolveRequestedOrganizationId,
};
