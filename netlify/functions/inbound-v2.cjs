// 🚀 THIS MUST APPEAR IN LOGS (confirms latest deploy)
console.log("🚀 INBOUND V2 ACTIVE");

const { createClient } = require("@supabase/supabase-js");
const querystring = require("querystring");

exports.handler = async (event) => {
  console.log("🔥 FUNCTION HIT");
  console.log("METHOD:", event.httpMethod);
  console.log("RAW BODY:", event.body);

  try {
    // Parse Twilio form-encoded body
    const parsed = querystring.parse(event.body || "");

    console.log("PARSED BODY:", parsed);

    const from = parsed.From;
    const body = parsed.Body;

    if (!from) {
      console.log("❌ No sender found");
      return {
        statusCode: 200,
        body: "No sender",
      };
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const normalized = from.replace("+1", "");

    console.log("📩 INCOMING SMS:", { from, body });

    // Find matching deal
    const { data: deals, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("phone", normalized)
      .limit(1);

    if (dealError) {
      console.error("❌ Deal lookup error:", dealError);
    }

    const deal = deals?.[0];

    if (!deal) {
      console.log("⚠️ No deal matched for:", normalized);
      return {
        statusCode: 200,
        body: "No deal matched",
      };
    }

    // Insert message into Supabase
    const { error: insertError } = await supabase
      .from("message_logs")
      .insert({
        deal_id: deal.id,
        phone: from,
        message: body,
        status: "received",
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("❌ Insert error:", insertError);
    } else {
      console.log("✅ Message saved to Supabase");
    }

    return {
      statusCode: 200,
      body: "OK",
    };
  } catch (err) {
    console.error("💥 FUNCTION ERROR:", err);

    return {
      statusCode: 500,
      body: "Error",
    };
  }
};