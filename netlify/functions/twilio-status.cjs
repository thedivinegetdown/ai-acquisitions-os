const { createClient } = require("@supabase/supabase-js");
const {
  logError,
  logInfo,
  safeTrim,
  text,
  truncate,
} = require("./_shared/security.cjs");
const {
  configuredTwilioRoute,
  normalizeProviderStatus,
  shouldApplyStatusTransition,
  validateTwilioWebhook,
} = require("./_shared/twilio.cjs");

const STATUS_PATH = "/.netlify/functions/twilio-status";

function createStatusHandler({
  createClientImpl = createClient,
  validateWebhook = validateTwilioWebhook,
  now = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const validation = validateWebhook(event, {
      path: STATUS_PATH,
      requiredFields: ["MessageSid", "MessageStatus"],
    });
    if (!validation.ok) return validation.response;

    const route = configuredTwilioRoute();
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !route.organizationId
    ) {
      return text(503, "Webhook processing is not configured.");
    }

    const providerMessageId = safeTrim(validation.params.MessageSid);
    const nextStatus = normalizeProviderStatus(
      validation.params.MessageStatus || validation.params.SmsStatus
    );
    if (nextStatus === "unknown") return text(400, "Unsupported status.");

    const adminClient = createClientImpl(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      }
    );

    try {
      const existing = await adminClient
        .from("message_logs")
        .select("id, provider_status, status, organization_id")
        .eq("organization_id", route.organizationId)
        .eq("provider", "twilio")
        .eq("provider_message_id", providerMessageId)
        .limit(1);
      if (existing.error) throw existing.error;

      const message = existing.data?.[0];
      if (!message) return text(404, "Message not found.");

      const currentStatus = message.provider_status || message.status;
      if (!shouldApplyStatusTransition(currentStatus, nextStatus)) {
        return text(200, "OK");
      }

      const updatedAt = now();
      const updated = await adminClient
        .from("message_logs")
        .update({
          status: nextStatus,
          provider_status: nextStatus,
          provider_status_updated_at: updatedAt,
          error_code: truncate(safeTrim(validation.params.ErrorCode), 64) || null,
          updated_at: updatedAt,
        })
        .eq("id", message.id)
        .eq("organization_id", route.organizationId)
        .eq("provider_message_id", providerMessageId);
      if (updated.error) throw updated.error;

      logInfo("[Twilio Status] Delivery state updated", {
        providerMessageId,
        organizationId: route.organizationId,
        fromStatus: currentStatus,
        toStatus: nextStatus,
      });
      return text(200, "OK");
    } catch (error) {
      logError("[Twilio Status] Processing failed", error);
      return text(500, "Webhook processing failed.");
    }
  };
}

exports.createStatusHandler = createStatusHandler;
exports.handler = createStatusHandler();
