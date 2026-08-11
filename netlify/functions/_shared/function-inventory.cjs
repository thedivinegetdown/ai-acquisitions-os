const FUNCTION_AUTHORIZATION_MATRIX = Object.freeze({
  "ai-analysis": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: false }),
  "ai-chat": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: false }),
  "ai-summary": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: false }),
  "send-sms": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: true }),
  "send-email": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: true }),
  "create-checkout-session": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: true }),
  "create-billing-portal-session": Object.freeze({ classification: "user-authenticated-api", tenant: true, mutation: true }),
  "inbound-v2": Object.freeze({
    classification: "external-webhook",
    bearerAuth: false,
    signatureValidation: "twilio-signature",
    tenant: "configured-single-organization-route",
    mutation: true,
  }),
  "twilio-status": Object.freeze({
    classification: "external-webhook",
    bearerAuth: false,
    signatureValidation: "twilio-signature",
    tenant: "configured-single-organization-route",
    mutation: true,
  }),
  "stripe-webhook": Object.freeze({
    classification: "external-webhook",
    bearerAuth: false,
    signatureValidation: "stripe-signature",
    tenant: false,
    mutation: false,
  }),
  "health-check": Object.freeze({
    classification: "public-safe",
    bearerAuth: false,
    tenant: false,
    mutation: false,
  }),
});

module.exports = { FUNCTION_AUTHORIZATION_MATRIX };
