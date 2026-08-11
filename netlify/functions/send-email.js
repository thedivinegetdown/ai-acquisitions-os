const {
  isLikelyEmail,
  json,
  parseJsonBody,
  requirePost,
  safeTrim,
  truncate,
} = require("./_shared/security.cjs");

const {
  MUTATION_ROLES,
  requireDealInOrganization,
  requireTenantContext,
} = require("./_shared/auth.cjs");
const MAX_SUBJECT_CHARS = 200;
const MAX_BODY_CHARS = 12000;

function createSendEmailHandler({
  authorize = requireTenantContext,
  verifyDeal = requireDealInOrganization,
} = {}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;

    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const authorization = await authorize(event, {
      allowedRoles: MUTATION_ROLES,
      requestedOrganizationId:
        parsed.body.organization_id || parsed.body.organizationId,
    });
    if (authorization.response) return authorization.response;

    const to = safeTrim(parsed.body.to);
    const subject = truncate(parsed.body.subject, MAX_SUBJECT_CHARS);
    const message = truncate(parsed.body.body || parsed.body.message, MAX_BODY_CHARS);
    const dealId = safeTrim(parsed.body.deal_id || parsed.body.dealId);

    if (dealId) {
      const deal = await verifyDeal(
        authorization.clients.adminClient,
        dealId,
        authorization.context.organizationId
      );
      if (deal.response) return deal.response;
    }

    if (!isLikelyEmail(to)) {
      return json(400, {
        success: false,
        error: "A valid recipient email is required.",
      });
    }

    if (!subject || !message) {
      return json(400, {
        success: false,
        error: "Email subject and body are required.",
      });
    }

    if (!process.env.EMAIL_PROVIDER || !process.env.EMAIL_API_KEY) {
      return json(200, {
        success: true,
        sent: false,
        status: "provider-unavailable",
        provider: process.env.EMAIL_PROVIDER || "not-configured",
        message:
          "Email foundation only - live email sending is not active yet. Draft was validated but not sent.",
      });
    }

    return json(200, {
      success: true,
      sent: false,
      status: "provider-placeholder",
      provider: process.env.EMAIL_PROVIDER,
      message:
        "Email provider configuration detected, but live sending is intentionally disabled in the foundation.",
    });
  };
}

exports.createSendEmailHandler = createSendEmailHandler;
exports.handler = createSendEmailHandler();
