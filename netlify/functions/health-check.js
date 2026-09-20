const { json, handleOptions } = require("./_shared/security.cjs");
const { getSupabaseRuntimeConfig } = require("./_shared/auth.cjs");

const REQUIRED_ENV = {
  supabase: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  openai: ["OPENAI_API_KEY"],
  twilio: [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "TWILIO_ORGANIZATION_ID",
    "PUBLIC_SITE_URL",
  ],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
};

function hasValue(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function buildIntegrationStatus(name, requiredEnv, missingOverride) {
  const missing = missingOverride || requiredEnv.filter((envName) => !hasValue(envName));

  return {
    name,
    configured: missing.length === 0,
    missing,
  };
}

function buildSupabaseStatus() {
  const config = getSupabaseRuntimeConfig();
  const missing = [];
  if (!config.url) missing.push("SUPABASE_URL");
  if (!config.anonKey) missing.push("SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY");
  if (!config.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  return buildIntegrationStatus("supabase", REQUIRED_ENV.supabase, missing);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return handleOptions();

  if (event.httpMethod !== "GET") {
    return json(405, { success: false, error: "Method not allowed." }, {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
  }

  const integrations = Object.entries(REQUIRED_ENV)
    .filter(([name]) => name !== "supabase")
    .map(([name, requiredEnv]) => buildIntegrationStatus(name, requiredEnv));
  const supabase = buildSupabaseStatus();
  integrations.unshift(supabase);
  const configured = supabase.configured;

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
