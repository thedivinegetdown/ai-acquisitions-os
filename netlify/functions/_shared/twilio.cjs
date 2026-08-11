const querystring = require("querystring");
const twilio = require("twilio");
const {
  normalizePhone,
  safeTrim,
  text,
} = require("./security.cjs");

const OPT_OUT_COMMANDS = Object.freeze([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);
const OPT_IN_COMMANDS = Object.freeze(["START", "UNSTOP"]);
const PROVIDER_STATUSES = Object.freeze([
  "queued",
  "accepted",
  "sending",
  "sent",
  "delivered",
  "undelivered",
  "failed",
]);
const STATUS_RANK = Object.freeze({
  queued: 0,
  accepted: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  undelivered: 4,
  failed: 4,
  unknown: -1,
});
const TERMINAL_STATUSES = new Set(["delivered", "undelivered", "failed"]);

function headerValue(event, name) {
  const target = name.toLowerCase();
  const entry = Object.entries(event?.headers || {}).find(
    ([key]) => key.toLowerCase() === target
  );
  return safeTrim(entry?.[1]);
}

function parseFormBody(event) {
  if (typeof event?.body !== "string" || !event.body.trim()) return null;
  try {
    const parsed = querystring.parse(event.body);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function canonicalPublicOrigin(env = process.env) {
  const configured = safeTrim(env.PUBLIC_SITE_URL);
  if (!configured) return "";

  try {
    const url = new URL(configured);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function buildWebhookUrl(path, env = process.env) {
  const origin = canonicalPublicOrigin(env);
  if (!origin || !safeTrim(path).startsWith("/")) return "";
  return new URL(path, `${origin}/`).toString();
}

function webhookResponse(statusCode, message) {
  return text(statusCode, message, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function validateTwilioWebhook(
  event,
  {
    env = process.env,
    path,
    requiredFields = [],
    validateRequestImpl = twilio.validateRequest,
  } = {}
) {
  const authToken = safeTrim(env.TWILIO_AUTH_TOKEN);
  const canonicalUrl = buildWebhookUrl(path, env);
  if (!authToken || !canonicalUrl) {
    return {
      ok: false,
      response: webhookResponse(503, "Webhook validation is not configured."),
    };
  }

  const signature = headerValue(event, "x-twilio-signature");
  if (!signature) {
    return {
      ok: false,
      response: webhookResponse(403, "Webhook signature required."),
    };
  }

  const params = parseFormBody(event);
  if (
    !params ||
    requiredFields.some((field) => !safeTrim(params[field]))
  ) {
    return {
      ok: false,
      response: webhookResponse(400, "Malformed webhook request."),
    };
  }

  let valid = false;
  try {
    valid = validateRequestImpl(authToken, signature, canonicalUrl, params);
  } catch {
    valid = false;
  }

  if (!valid) {
    return {
      ok: false,
      response: webhookResponse(403, "Invalid webhook signature."),
    };
  }

  return { ok: true, params, canonicalUrl };
}

function classifyConsentCommand(body) {
  const command = safeTrim(body).toUpperCase();
  if (OPT_OUT_COMMANDS.includes(command)) return "opted-out";
  if (OPT_IN_COMMANDS.includes(command)) return "opted-in";
  if (command === "HELP") return "help";
  return "ordinary";
}

function normalizeProviderStatus(status) {
  const normalized = safeTrim(status).toLowerCase();
  return PROVIDER_STATUSES.includes(normalized) ? normalized : "unknown";
}

function shouldApplyStatusTransition(currentStatus, nextStatus) {
  const current = normalizeProviderStatus(currentStatus);
  const next = normalizeProviderStatus(nextStatus);

  if (next === "unknown") return false;
  if (current === "unknown") return true;
  if (current === next) return false;
  if (TERMINAL_STATUSES.has(current)) return false;
  return STATUS_RANK[next] >= STATUS_RANK[current];
}

function configuredTwilioRoute(env = process.env) {
  return {
    organizationId: safeTrim(env.TWILIO_ORGANIZATION_ID),
    destinationPhone: normalizePhone(
      env.TWILIO_PHONE_NUMBER || env.TWILIO_PHONE
    ),
  };
}

module.exports = {
  OPT_IN_COMMANDS,
  OPT_OUT_COMMANDS,
  buildWebhookUrl,
  classifyConsentCommand,
  configuredTwilioRoute,
  headerValue,
  normalizeProviderStatus,
  parseFormBody,
  shouldApplyStatusTransition,
  validateTwilioWebhook,
  webhookResponse,
};
