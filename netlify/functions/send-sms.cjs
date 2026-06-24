const { createClient } = require("@supabase/supabase-js");
const twilio = require("twilio");

/**
 * Environment Variables Needed:
 *
 * SUPABASE_URL=
 * SUPABASE_SERVICE_ROLE_KEY=
 * SUPABASE_ANON_KEY= (optional fallback)
 *
 * TWILIO_ACCOUNT_SID=
 * TWILIO_AUTH_TOKEN=
 * TWILIO_PHONE_NUMBER=
 *
 * SMS_TEST_MODE=true|false
 */

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("ENV CHECK:", {
  hasUrl: !!process.env.SUPABASE_URL,
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
  hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
  testMode: process.env.SMS_TEST_MODE,
});

let supabase = null;

try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[SMS] Supabase initialized");
  } else {
    console.warn("[SMS] Supabase env vars missing");
  }
} catch (error) {
  console.error("[SMS] Failed to initialize Supabase:", error);
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const testMode = process.env.SMS_TEST_MODE === "true";

exports.handler = async (event) => {
  try {
    return await handleRequest(event);
  } catch (fatalError) {
    console.error("[SMS] Fatal error:", fatalError);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Fatal server error: ${fatalError.message}`,
      }),
    };
  }
};

async function handleRequest(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
    };
  }

  let parsedBody = {};

  try {
    parsedBody = JSON.parse(event.body || "{}");
  } catch (parseError) {
    console.error("[SMS] Invalid request JSON:", parseError);

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Invalid JSON in request body",
      }),
    };
  }

  const to = parsedBody.to || parsedBody.phone || "";
  const message = parsedBody.message || parsedBody.body || "";
  const deal_id = parsedBody.deal_id || parsedBody.dealId || null;

  console.log("[SMS] Incoming request:", {
    to,
    deal_id,
    hasMessage: !!message,
    messageLength: message.length,
    rawBody: event.body,
  });

  if (!to.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Missing recipient phone number",
      }),
    };
  }

  if (!message.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Missing message body",
      }),
    };
  }

  if (!deal_id) {
    console.log(
      "[SMS] No deal_id provided. Continuing send; function-side deal log will be skipped."
    );
  }

  let mode = "live";
  let status = "sent";
  let provider_sid = null;

  if (testMode || !accountSid || !authToken || !fromNumber) {
    mode = "test";
    status = "test";
    provider_sid = "TEST_MESSAGE";

    console.log("[SMS] Test mode or missing Twilio env. Twilio will not be called:", {
      to,
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
      testMode,
    });
    console.log(`[SMS TEST MODE] Message: ${message}`);
  } else {
    try {
      console.log("[SMS] Calling Twilio messages.create:", {
        from: fromNumber,
        to,
        messageLength: message.length,
      });

      const client = twilio(accountSid, authToken);

      const twilioResult = await client.messages.create({
        body: message,
        from: fromNumber,
        to,
      });

      provider_sid = twilioResult.sid;

      console.log("[SMS] Twilio sent:", {
        sid: provider_sid,
        status: twilioResult.status,
        to: twilioResult.to,
        from: twilioResult.from,
      });
    } catch (twilioError) {
      console.error("[SMS] Twilio error:", twilioError);

      if (deal_id) {
        await saveLog({
          deal_id,
          phone: to,
          message,
          status: "failed",
          direction: "outbound",
        });
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Twilio send failed: ${twilioError.message}`,
        }),
      };
    }
  }

  if (deal_id) {
    await saveLog({
      deal_id,
      phone: to,
      message,
      status,
      direction: "outbound",
    });
  } else {
    console.log(
      "[SMS] Send succeeded without deal_id. Skipping function log so the conversation UI can write the outbound log once."
    );
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      mode,
      status,
      sid: provider_sid,
      message:
        mode === "live"
          ? "SMS sent successfully"
          : "Message saved in test mode",
    }),
  };
}

async function saveLog(logData) {
  if (!supabase) {
    console.warn("[SMS] Supabase unavailable. Log skipped.");
    return;
  }

  try {
    console.log("[SMS] Saving message log:", {
      deal_id: logData.deal_id,
      phone: logData.phone,
      status: logData.status,
      direction: logData.direction,
      messageLength: logData.message?.length || 0,
    });

    const { error } = await supabase
      .from("message_logs")
      .insert({
        deal_id: logData.deal_id,
        phone: logData.phone,
        message: logData.message,
        status: logData.status,
        direction: logData.direction,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[SMS] Log insert error:", error);
    } else {
      console.log("[SMS] Log saved successfully");
    }
  } catch (dbError) {
    console.error("[SMS] Database error:", dbError);
  }
}
