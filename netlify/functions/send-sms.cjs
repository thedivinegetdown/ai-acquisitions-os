const { createClient } = require("@supabase/supabase-js");
const twilio = require("twilio");
const {
  isValidPhone,
  json,
  logError,
  logInfo,
  logWarn,
  normalizePhone,
  parseJsonBody,
  requirePost,
  safeTrim,
  truncate,
} = require("./_shared/security.cjs");

const MAX_SMS_CHARS = 1600;

let supabase = null;

try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    logWarn("[SMS] Supabase server configuration is incomplete.");
  }
} catch (error) {
  logError("[SMS] Failed to initialize Supabase", error);
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE;
const testMode = process.env.SMS_TEST_MODE === "true";

exports.handler = async (event) => {
  try {
    return await handleRequest(event);
  } catch (error) {
    logError("[SMS] Unexpected function error", error);
    return json(500, {
      success: false,
      error: "SMS request failed.",
    });
  }
};

async function handleRequest(event) {
  const methodResponse = requirePost(event);
  if (methodResponse) return methodResponse;

  const parsed = parseJsonBody(event);
  if (parsed.error) return json(400, { success: false, error: parsed.error });

  const to = normalizePhone(parsed.body.to || parsed.body.phone);
  const message = truncate(parsed.body.message || parsed.body.body, MAX_SMS_CHARS);
  const dealId = safeTrim(parsed.body.deal_id || parsed.body.dealId) || null;

  logInfo("[SMS] Request received", {
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
      const client = twilio(accountSid, authToken);
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

      if (dealId) {
        await saveLog({
          deal_id: dealId,
          phone: to,
          message,
          status: "failed",
          direction: "outbound",
        });
      }

      return json(502, {
        success: false,
        error: "SMS provider failed to send message.",
      });
    }
  }

  if (dealId) {
    await saveLog({
      deal_id: dealId,
      phone: to,
      message,
      status,
      direction: "outbound",
    });
  }

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

async function saveLog(logData) {
  if (!supabase) {
    logWarn("[SMS] Supabase unavailable. Message log skipped.");
    return;
  }

  try {
    const { error } = await supabase.from("message_logs").insert({
      deal_id: logData.deal_id,
      phone: logData.phone,
      message: logData.message,
      status: logData.status,
      direction: logData.direction,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logError("[SMS] Message log insert failed", error);
    }
  } catch (error) {
    logError("[SMS] Message log write failed", error);
  }
}
