const { createClient } = require("@supabase/supabase-js");
const querystring = require("querystring");
const {
  logError,
  logInfo,
  normalizeUsPhoneDigits,
  safeTrim,
  text,
  truncate,
} = require("./_shared/security.cjs");

const MAX_SMS_CHARS = 1600;

function parseFormBody(event) {
  return querystring.parse(event.body || "");
}

exports.handler = async (event) => {
  logInfo("[Inbound SMS] Function hit", { method: event.httpMethod });

  try {
    if (event.httpMethod !== "POST") {
      return text(405, "Method not allowed");
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logError("[Inbound SMS] Missing Supabase server configuration");
      return text(500, "Server configuration error");
    }

    const parsed = parseFormBody(event);
    const from = safeTrim(parsed.From);
    const body = truncate(parsed.Body, MAX_SMS_CHARS);

    if (!from) {
      logInfo("[Inbound SMS] No sender found");
      return text(200, "No sender");
    }

    if (!body) {
      logInfo("[Inbound SMS] Empty message ignored", { hasFrom: true });
      return text(200, "No message");
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const normalized = normalizeUsPhoneDigits(from);

    logInfo("[Inbound SMS] Incoming message", {
      hasFrom: true,
      messageLength: body.length,
    });

    const { data: deals, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("phone", normalized)
      .limit(1);

    if (dealError) {
      logError("[Inbound SMS] Deal lookup error", dealError);
    }

    const deal = deals?.[0];

    if (!deal) {
      logInfo("[Inbound SMS] No deal matched", { hasPhone: !!normalized });
      return text(200, "No deal matched");
    }

    const payload = {
      deal_id: deal.id,
      phone: from,
      message: body,
      direction: "inbound",
      status: "received",
      created_at: new Date().toISOString(),
    };

    let { error: insertError } = await supabase.from("message_logs").insert(payload);

    if (isMissingDirectionColumnError(insertError)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.direction;
      ({ error: insertError } = await supabase
        .from("message_logs")
        .insert(legacyPayload));
    }

    if (insertError) {
      logError("[Inbound SMS] Insert error", insertError);
    } else {
      logInfo("[Inbound SMS] Message saved to Supabase");
    }

    return text(200, "OK");
  } catch (error) {
    logError("[Inbound SMS] Function error", error);
    return text(500, "Error");
  }
};

function isMissingDirectionColumnError(error) {
  return (
    error?.code === "42703" ||
    String(error?.message || "")
      .toLowerCase()
      .includes("message_logs.direction")
  );
}
