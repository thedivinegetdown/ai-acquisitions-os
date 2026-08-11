const twilio = require("twilio");
const {
  isValidPhone,
  json,
  logError,
  logInfo,
  normalizePhone,
  parseJsonBody,
  requirePost,
  safeTrim,
  truncate,
} = require("./_shared/security.cjs");
const {
  MUTATION_ROLES,
  requireDealInOrganization,
  requireTenantContext,
} = require("./_shared/auth.cjs");
const {
  buildWebhookUrl,
  normalizeProviderStatus,
} = require("./_shared/twilio.cjs");

const MAX_SMS_CHARS = 1600;

function createSendSmsHandler({
  authorize = requireTenantContext,
  loadConsent = loadSmsConsent,
  verifyDeal = requireDealInOrganization,
  twilioFactory = twilio,
  now = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    try {
      return await handleRequest(event, {
        authorize,
        loadConsent,
        now,
        verifyDeal,
        twilioFactory,
      });
    } catch (error) {
      logError("[SMS] Unexpected function error", error);
      return json(500, {
        success: false,
        error: "SMS request failed.",
      });
    }
  };
}

exports.createSendSmsHandler = createSendSmsHandler;
exports.handler = createSendSmsHandler();

async function handleRequest(
  event,
  { authorize, loadConsent, now, verifyDeal, twilioFactory }
) {
  const methodResponse = requirePost(event);
  if (methodResponse) return methodResponse;

  const parsed = parseJsonBody(event);
  if (parsed.error) return json(400, { success: false, error: parsed.error });

  const authorization = await authorize(event, {
    allowedRoles: MUTATION_ROLES,
    requestedOrganizationId:
      parsed.body.organization_id || parsed.body.organizationId,
  });
  if (authorization.response) return authorization.response;

  const to = normalizePhone(parsed.body.to || parsed.body.phone);
  const message = truncate(parsed.body.message || parsed.body.body, MAX_SMS_CHARS);
  const dealId = safeTrim(parsed.body.deal_id || parsed.body.dealId) || null;
  const { adminClient } = authorization.clients;
  const { organizationId, userId } = authorization.context;

  if (dealId) {
    const deal = await verifyDeal(adminClient, dealId, organizationId);
    if (deal.response) return deal.response;
  }

  logInfo("[SMS] Authorized request", {
    userId,
    organizationId,
    hasRecipient: !!to,
    hasDealId: !!dealId,
    hasMessage: !!message,
    messageLength: message.length,
  });

  if (!isValidPhone(to)) {
    return json(400, {
      success: false,
      error: "Missing or invalid recipient phone number.",
    });
  }

  if (!message) {
    return json(400, {
      success: false,
      error: "Missing message body.",
    });
  }

  const consent = await loadConsent(adminClient, organizationId, to);
  if (consent.response) return consent.response;
  if (consent.status === "opted-out") {
    return json(403, {
      success: false,
      status: "blocked-by-opt-out",
      error: "SMS delivery is blocked by recipient consent status.",
    });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE;
  const providerOrganizationId = safeTrim(
    process.env.TWILIO_ORGANIZATION_ID
  );
  const liveMode = process.env.SMS_TEST_MODE === "false";
  const statusCallback = buildWebhookUrl(
    "/.netlify/functions/twilio-status"
  );
  let mode = liveMode ? "live" : "test";
  let status = "test";
  let providerSid = null;
  const sentAt = now();

  if (!liveMode) {
    logInfo("[SMS] Explicit test mode active.", {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
      liveMode,
    });
  } else if (
    !accountSid ||
    !authToken ||
    !fromNumber ||
    !statusCallback ||
    !providerOrganizationId ||
    providerOrganizationId !== organizationId
  ) {
    return json(503, {
      success: false,
      error: "Live SMS is not fully configured.",
    });
  } else {
    try {
      const client = twilioFactory(accountSid, authToken);
      const twilioResult = await client.messages.create({
        body: message,
        from: fromNumber,
        statusCallback,
        to,
      });

      providerSid = safeTrim(twilioResult.sid);
      status = normalizeProviderStatus(twilioResult.status);
      if (status === "unknown") status = "accepted";

      logInfo("[SMS] Twilio send accepted", {
        status,
        hasProviderSid: !!providerSid,
      });
    } catch (error) {
      logError("[SMS] Twilio send failed", error);
      await saveLog(adminClient, {
        organization_id: organizationId,
        deal_id: dealId,
        phone: to,
        message,
        status: "failed",
        direction: "outbound",
        provider: "twilio",
        provider_message_id: null,
        provider_status: "failed",
        provider_status_updated_at: sentAt,
        error_code:
          truncate(safeTrim(String(error?.code || "")), 64) || null,
        created_at: sentAt,
        updated_at: sentAt,
      });

      return json(502, {
        success: false,
        error: "SMS provider failed to send message.",
      });
    }
  }

  await saveLog(adminClient, {
    organization_id: organizationId,
    deal_id: dealId,
    phone: to,
    message,
    status,
    direction: "outbound",
    provider: mode === "live" ? "twilio" : null,
    provider_message_id: mode === "live" ? providerSid : null,
    provider_status: mode === "live" ? status : null,
    provider_status_updated_at: mode === "live" ? sentAt : null,
    error_code: null,
    created_at: sentAt,
    updated_at: sentAt,
  });

  return json(200, {
    success: true,
    mode,
    status,
    sid: providerSid || (mode === "test" ? "TEST_MESSAGE" : null),
    message:
      mode === "live"
        ? "SMS accepted by provider."
        : "Message saved in test mode.",
  });
}

async function loadSmsConsent(adminClient, organizationId, phone) {
  try {
    const { data, error } = await adminClient
      .from("communication_consents")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("normalized_phone", phone)
      .eq("channel", "sms")
      .limit(1);

    if (error) {
      return {
        response: json(503, {
          success: false,
          error: "SMS consent status is unavailable.",
        }),
      };
    }

    return { status: data?.[0]?.status || "unknown" };
  } catch {
    return {
      response: json(503, {
        success: false,
        error: "SMS consent status is unavailable.",
      }),
    };
  }
}

async function saveLog(adminClient, logData) {
  try {
    const payload = {
      organization_id: logData.organization_id,
      deal_id: logData.deal_id,
      phone: logData.phone,
      message: logData.message,
      status: logData.status,
      direction: logData.direction,
      provider: logData.provider,
      provider_message_id: logData.provider_message_id,
      provider_status: logData.provider_status,
      provider_status_updated_at: logData.provider_status_updated_at,
      error_code: logData.error_code,
      created_at: logData.created_at,
      updated_at: logData.updated_at,
    };

    let { error } = await adminClient.from("message_logs").insert(payload);

    if (isMissingDirectionColumnError(error)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.direction;
      ({ error } = await adminClient.from("message_logs").insert(legacyPayload));
    }

    if (error) {
      logError("[SMS] Message log insert failed", error);
    }
  } catch (error) {
    logError("[SMS] Message log write failed", error);
  }
}

function isMissingDirectionColumnError(error) {
  return (
    error?.code === "42703" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("message_logs.direction")
  );
}
