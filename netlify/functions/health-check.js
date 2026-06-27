const { json, handleOptions } = require("./_shared/security.cjs");

const REQUIRED_ENV = {
  supabase: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  openai: ["OPENAI_API_KEY"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
};

function hasValue(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function buildIntegrationStatus(name, requiredEnv) {
  const missing = requiredEnv.filter((envName) => !hasValue(envName));

  return {
    name,
    configured: missing.length === 0,
    missing,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();

  if (event.httpMethod !== "GET") {
    return json(405, { success: false, error: "Method not allowed." }, {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
  }

  const integrations = Object.entries(REQUIRED_ENV).map(([name, requiredEnv]) =>
    buildIntegrationStatus(name, requiredEnv)
  );
  const configured = integrations.every((integration) => integration.configured);

  return json(
    configured ? 200 : 503,
    {
      success: true,
      status: configured ? "ok" : "degraded",
      configured,
      checkedAt: new Date().toISOString(),
      integrations,
    },
    {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
    }
  );
};
