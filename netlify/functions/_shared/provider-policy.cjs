const { json } = require("./security.cjs");

async function consumeProviderRequest(
  adminClient,
  { organizationId, provider, promptCharacters }
) {
  try {
    const { data, error } = await adminClient.rpc(
      "consume_organization_provider_request",
      {
        p_organization_id: organizationId,
        p_provider: provider,
        p_prompt_characters: promptCharacters,
      }
    );
    if (error || !data?.allowed) {
      const reason = data?.reason || "provider-policy-unavailable";
      return {
        response: json(reason === "monthly-cap-reached" ? 429 : 503, {
          success: false,
          status: reason,
          error:
            reason === "monthly-cap-reached"
              ? "Organization provider usage cap reached."
              : "Provider is not enabled for this organization.",
        }),
      };
    }
    return { policy: data };
  } catch {
    return {
      response: json(503, {
        success: false,
        status: "provider-policy-unavailable",
        error: "Provider is not enabled for this organization.",
      }),
    };
  }
}

async function consumeProviderRequests(
  adminClient,
  { organizationId, provider, requestCount }
) {
  try {
    const { data, error } = await adminClient.rpc(
      "consume_organization_provider_requests",
      {
        p_organization_id: organizationId,
        p_provider: provider,
        p_request_count: requestCount,
      }
    );
    if (error || !data?.allowed) {
      const reason = data?.reason || "provider-policy-unavailable";
      return {
        response: json(reason === "monthly-cap-reached" ? 429 : 503, {
          success: false,
          status: reason,
          error: reason === "monthly-cap-reached"
            ? "Organization provider usage cap reached."
            : "Provider is not enabled for this organization.",
        }),
      };
    }
    return { policy: data };
  } catch {
    return {
      response: json(503, {
        success: false,
        status: "provider-policy-unavailable",
        error: "Provider is not enabled for this organization.",
      }),
    };
  }
}

module.exports = { consumeProviderRequest, consumeProviderRequests };
