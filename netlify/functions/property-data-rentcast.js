const { MEMBERSHIP_ROLES, requireTenantContext } = require("./_shared/auth.cjs");
const { consumeProviderRequests } = require("./_shared/provider-policy.cjs");
const { fetchRentCastPropertyData, RENTCAST_REQUEST_COUNT } = require("./_shared/rentcast.cjs");
const { json, parseJsonBody, requirePost, safeErrorMessage, safeTrim } = require("./_shared/security.cjs");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function propertyIdentity(address) {
  return safeTrim(address).replace(/\s+/g, " ").toLowerCase();
}

const repository = {
  async loadDeal(adminClient, dealId, organizationId) {
    const { data, error } = await adminClient.from("deals")
      .select("id, organization_id, property_address, asset_type, property_type")
      .eq("id", dealId).eq("organization_id", organizationId).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  },
  async loadPolicy(adminClient, organizationId) {
    const { data, error } = await adminClient.from("organization_provider_policies")
      .select("provider, enabled, monthly_request_cap, updated_at")
      .eq("organization_id", organizationId).eq("provider", "rentcast").limit(1);
    if (error) throw error;
    return data?.[0] || null;
  },
  async loadEvidence(adminClient, dealId, organizationId) {
    const { data, error } = await adminClient.from("property_provider_evidence")
      .select("id, organization_id, deal_id, provider, property_identity, provider_record_id, retrieved_at, expires_at, normalized_data")
      .eq("organization_id", organizationId).eq("deal_id", dealId)
      .eq("provider", "rentcast").limit(1);
    if (error) throw error;
    return data?.[0] || null;
  },
  async persistEvidence(adminClient, evidence) {
    const { data, error } = await adminClient.from("property_provider_evidence")
      .upsert(evidence, { onConflict: "organization_id,deal_id,provider" })
      .select().limit(1);
    if (error) throw error;
    return data?.[0] || null;
  },
};

function publicProviderState(policy, configured, usage = null) {
  return {
    id: "rentcast",
    enabled: policy?.enabled === true,
    configured,
    monthlyRequestCap: policy?.monthly_request_cap ?? null,
    usage: usage ? {
      requestCount: usage.request_count,
      monthlyRequestCap: usage.monthly_request_cap,
    } : null,
  };
}

function publicEvidence(evidence, now, expectedIdentity) {
  if (!evidence || evidence.property_identity !== expectedIdentity) return null;
  const fresh = new Date(evidence.expires_at).getTime() > new Date(now).getTime();
  return {
    id: evidence.id,
    provider: evidence.provider,
    providerRecordId: evidence.provider_record_id,
    retrievedAt: evidence.retrieved_at,
    cacheState: fresh ? "fresh" : "stale",
    data: evidence.normalized_data,
  };
}

function createHandler({
  authorize = requireTenantContext,
  providerAuthorization = consumeProviderRequests,
  providerRequest = fetchRentCastPropertyData,
  dataRepository = repository,
  clock = () => new Date().toISOString(),
  env = process.env,
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;
    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });
    const action = parsed.body.action;
    const dealId = safeTrim(parsed.body.dealId);
    if (!dealId || !["status", "refresh"].includes(action)) {
      return json(400, { success: false, error: "A supported action and deal are required." });
    }

    const allowedRoles = action === "refresh" ? ["owner"] : MEMBERSHIP_ROLES;
    const authorization = await authorize(event, { allowedRoles });
    if (authorization.response) return authorization.response;
    const { adminClient } = authorization.clients;
    const organizationId = authorization.context.organizationId;

    try {
      const [deal, policy, cached] = await Promise.all([
        dataRepository.loadDeal(adminClient, dealId, organizationId),
        dataRepository.loadPolicy(adminClient, organizationId),
        dataRepository.loadEvidence(adminClient, dealId, organizationId),
      ]);
      if (!deal) return json(404, { success: false, error: "Resource not found." });
      const address = safeTrim(deal.property_address);
      if (!address) return json(400, { success: false, error: "The deal has no property address." });
      const now = clock();
      const identity = propertyIdentity(address);
      const evidence = publicEvidence(cached, now, identity);
      const configured = Boolean(safeTrim(env.RENTCAST_API_KEY));
      const provider = publicProviderState(policy, configured);

      if (action === "status") {
        return json(200, { success: true, provider, evidence });
      }
      if (!policy?.enabled) {
        return json(503, { success: false, status: "provider-disabled", error: "RentCast is disabled for this organization.", provider, evidence });
      }
      if (evidence?.cacheState === "fresh") {
        return json(200, { success: true, provider, evidence, cacheHit: true });
      }
      if (!configured) {
        return json(503, { success: false, status: "provider-unconfigured", error: "RentCast is not configured.", provider, evidence });
      }

      const access = await providerAuthorization(adminClient, {
        organizationId,
        provider: "rentcast",
        requestCount: RENTCAST_REQUEST_COUNT,
      });
      if (access.response) return access.response;
      const normalized = await providerRequest({
        address,
        apiKey: env.RENTCAST_API_KEY,
        retrievedAt: now,
      });
      const expiresAt = new Date(new Date(now).getTime() + CACHE_TTL_MS).toISOString();
      const stored = await dataRepository.persistEvidence(adminClient, {
        organization_id: organizationId,
        deal_id: deal.id,
        provider: "rentcast",
        property_identity: identity,
        provider_record_id: normalized.providerRecordId || null,
        retrieved_at: now,
        expires_at: expiresAt,
        normalized_data: normalized,
        updated_at: now,
      });
      return json(200, {
        success: true,
        provider: publicProviderState(policy, configured, access.policy),
        evidence: publicEvidence(stored, now, identity),
        cacheHit: false,
      });
    } catch (error) {
      return json(error?.status === 429 ? 429 : error?.status === 504 ? 504 : 502, {
        success: false,
        error: safeErrorMessage(error, "RentCast property data is unavailable."),
      });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
