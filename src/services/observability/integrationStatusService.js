import { appConfig, validateClientConfig } from "../config";

export const HEALTH_STATUSES = {
  HEALTHY: "Healthy",
  WARNING: "Warning",
  ERROR: "Error",
  NOT_CONFIGURED: "Not configured",
  UNKNOWN: "Unknown",
};

const SERVER_SIDE_ONLY_MESSAGE =
  "Server-side configuration cannot be inspected from the browser.";

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function buildStatus({
  id,
  label,
  status,
  description,
  requiredEnv = [],
  missingEnv = [],
  warnings = [],
  checkedAt = new Date().toISOString(),
}) {
  return {
    id,
    label,
    status,
    description,
    requiredEnv,
    missingEnv,
    warnings,
    checkedAt,
  };
}

export function getIntegrationStatuses() {
  const clientConfig = validateClientConfig();
  const apiBaseConfigured = hasValue(appConfig.apiBasePath);

  return [
    buildStatus({
      id: "supabase",
      label: "Supabase",
      status: clientConfig.success
        ? HEALTH_STATUSES.HEALTHY
        : HEALTH_STATUSES.NOT_CONFIGURED,
      description: clientConfig.success
        ? "Client Supabase configuration appears present."
        : "Client Supabase configuration is missing.",
      requiredEnv: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      missingEnv: clientConfig.missing,
    }),
    buildStatus({
      id: "netlify-functions",
      label: "Netlify Functions",
      status: apiBaseConfigured
        ? HEALTH_STATUSES.HEALTHY
        : HEALTH_STATUSES.WARNING,
      description: apiBaseConfigured
        ? `Functions base path is configured as ${appConfig.apiBasePath}.`
        : "Functions base path is using default configuration.",
      requiredEnv: ["VITE_NETLIFY_FUNCTIONS_BASE"],
      missingEnv: apiBaseConfigured ? [] : ["VITE_NETLIFY_FUNCTIONS_BASE"],
    }),
    buildStatus({
      id: "twilio",
      label: "Twilio",
      status: HEALTH_STATUSES.UNKNOWN,
      description: SERVER_SIDE_ONLY_MESSAGE,
      requiredEnv: [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
      ],
      warnings: ["SMS test mode and Twilio credentials must be verified in Netlify."],
    }),
    buildStatus({
      id: "openai",
      label: "OpenAI",
      status: HEALTH_STATUSES.UNKNOWN,
      description: SERVER_SIDE_ONLY_MESSAGE,
      requiredEnv: ["OPENAI_API_KEY", "OPENAI_MODEL"],
      warnings: ["Rule-based fallback should remain enabled if OpenAI is unavailable."],
    }),
    buildStatus({
      id: "stripe",
      label: "Stripe",
      status: HEALTH_STATUSES.UNKNOWN,
      description: SERVER_SIDE_ONLY_MESSAGE,
      requiredEnv: [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_STARTER",
        "STRIPE_PRICE_GROWTH",
        "STRIPE_PRICE_PRO",
      ],
      warnings: ["Stripe is test-mode only and billing enforcement is inactive."],
    }),
    buildStatus({
      id: "sms-logging",
      label: "SMS Logging",
      status: clientConfig.success
        ? HEALTH_STATUSES.WARNING
        : HEALTH_STATUSES.NOT_CONFIGURED,
      description: clientConfig.success
        ? "Supabase client is configured; message_logs table access still needs runtime verification."
        : "SMS logging requires Supabase configuration.",
      requiredEnv: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      missingEnv: clientConfig.missing,
    }),
    buildStatus({
      id: "ai-fallback-provider",
      label: "AI Fallback Provider",
      status: HEALTH_STATUSES.HEALTHY,
      description: "Rule-based AI fallback services are available in the client bundle.",
      requiredEnv: [],
      missingEnv: [],
    }),
    buildStatus({
      id: "build-deployment",
      label: "Build / Deployment Readiness",
      status: appConfig.isProduction
        ? HEALTH_STATUSES.HEALTHY
        : HEALTH_STATUSES.WARNING,
      description: appConfig.isProduction
        ? "App is running in production mode."
        : "App is currently running outside production mode.",
      requiredEnv: ["CI build", "npm run build", "npm run test:run"],
      warnings: appConfig.isProduction
        ? []
        : ["Run production build and tests before deployment."],
    }),
  ];
}

export function getMissingEnvironmentVariables(statuses = getIntegrationStatuses()) {
  return [
    ...new Set(
      statuses.flatMap((status) =>
        Array.isArray(status.missingEnv) ? status.missingEnv : []
      )
    ),
  ];
}
