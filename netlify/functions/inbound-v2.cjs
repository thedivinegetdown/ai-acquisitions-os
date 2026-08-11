const { createClient } = require("@supabase/supabase-js");
const {
  logError,
  logInfo,
  normalizePhone,
  normalizeUsPhoneDigits,
  safeTrim,
  text,
  truncate,
} = require("./_shared/security.cjs");
const {
  classifyConsentCommand,
  configuredTwilioRoute,
  validateTwilioWebhook,
} = require("./_shared/twilio.cjs");

const MAX_SMS_CHARS = 1600;
const INBOUND_PATH = "/.netlify/functions/inbound-v2";

function twiml(statusCode = 200, message = "") {
  return text(
    statusCode,
    message || '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    }
  );
}

function createInboundHandler({
  createClientImpl = createClient,
  validateWebhook = validateTwilioWebhook,
  now = () => new Date().toISOString(),
} = {}) {
  return async (event) => {
    if (event.httpMethod !== "POST") return text(405, "Method not allowed");

    const validation = validateWebhook(event, {
      path: INBOUND_PATH,
      requiredFields: ["MessageSid", "From", "To", "Body"],
    });
    if (!validation.ok) return validation.response;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logError("[Inbound SMS] Missing Supabase server configuration");
      return text(503, "Server configuration error");
    }

    const route = configuredTwilioRoute();
    const destination = normalizePhone(validation.params.To);
    if (
      !route.organizationId ||
      !route.destinationPhone ||
      destination !== route.destinationPhone
    ) {
      logInfo("[Inbound SMS] Tenant route rejected", {
        hasOrganizationRoute: !!route.organizationId,
        destinationMatched: destination === route.destinationPhone,
      });
      return text(403, "Webhook route is not configured.");
    }

    const providerMessageId = safeTrim(validation.params.MessageSid);
    const from = normalizePhone(validation.params.From);
    const dealPhone = normalizeUsPhoneDigits(validation.params.From);
    const body = truncate(validation.params.Body, MAX_SMS_CHARS);
    const receivedAt = now();
    const consentEvent = classifyConsentCommand(body);
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
      const duplicate = await adminClient
        .from("message_logs")
        .select("id")
        .eq("organization_id", route.organizationId)
        .eq("provider", "twilio")
        .eq("provider_message_id", providerMessageId)
        .limit(1);

      if (duplicate.error) throw duplicate.error;
      if (duplicate.data?.[0]) {
        logInfo("[Inbound SMS] Duplicate provider event ignored", {
          providerMessageId,
          organizationId: route.organizationId,
        });
        return twiml();
      }

      if (consentEvent === "opted-in" || consentEvent === "opted-out") {
        const consent = await adminClient.from("communication_consents").upsert(
          {
            organization_id: route.organizationId,
            normalized_phone: from,
            channel: "sms",
            status: consentEvent,
            source: "twilio-inbound",
            provider: "twilio",
            last_event_at: receivedAt,
            updated_at: receivedAt,
          },
          { onConflict: "organization_id,normalized_phone,channel" }
        );
        if (consent.error) throw consent.error;
      }

      const dealResult = await adminClient
        .from("deals")
        .select("id, organization_id")
        .eq("organization_id", route.organizationId)
        .eq("phone", dealPhone)
        .limit(1);
      if (dealResult.error) throw dealResult.error;

      const payload = {
        organization_id: route.organizationId,
        deal_id: dealResult.data?.[0]?.id || null,
        phone: from,
        message: body,
        direction: "inbound",
        status: "received",
        provider: "twilio",
        provider_message_id: providerMessageId,
        provider_status: "received",
        provider_status_updated_at: receivedAt,
        consent_event: consentEvent === "ordinary" ? null : consentEvent,
        created_at: receivedAt,
        updated_at: receivedAt,
      };
      const inserted = await adminClient.from("message_logs").insert(payload);

      if (inserted.error?.code === "23505") return twiml();
      if (inserted.error) throw inserted.error;

      logInfo("[Inbound SMS] Provider event persisted", {
        providerMessageId,
        organizationId: route.organizationId,
        linkedDeal: !!payload.deal_id,
        consentEvent,
      });
      return twiml();
    } catch (error) {
      logError("[Inbound SMS] Processing failed", error);
      return text(500, "Webhook processing failed.");
    }
  };
}

exports.createInboundHandler = createInboundHandler;
exports.handler = createInboundHandler();
