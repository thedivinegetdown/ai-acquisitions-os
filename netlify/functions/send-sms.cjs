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

const MAX_SMS_CHARS = 1600;

function createSendSmsHandler({
  authorize = requireTenantContext,
  verifyDeal = requireDealInOrganization,
  twilioFactory = twilio,
} = {}) {
  return async (event) => {
    try {
      return await handleRequest(event, { authorize, verifyDeal, twilioFactory });
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

async function handleRequest(event, { authorize, verifyDeal, twilioFactory }) {
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

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE;
  const testMode = process.env.SMS_TEST_MODE === "true";
  let mode = "live";
  let status = "sent";
  let providerSid = null;

  if (testMode || !accountSid || !authToken || !fromNumber) {
    mode = "test";
    status = "test";
    providerSid = "TEST_MESSAGE";

    logInfo("[SMS] Test mode active or provider configuration incomplete.", {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
      testMode,
    });
  } else {
    try {
      const client = twilioFactory(accountSid, authToken);
      const twilioResult = await client.messages.create({
        body: message,
        from: fromNumber,
        to,
      });

      providerSid = twilioResult.sid;
      status = twilioResult.status || status;

      logInfo("[SMS] Twilio send completed", {
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
  });

  return json(200, {
    success: true,
    mode,
    status,
    sid: providerSid,
    message:
      mode === "live"
        ? "SMS sent successfully."
        : "Message saved in test mode.",
  });
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
      created_at: new Date().toISOString(),
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
