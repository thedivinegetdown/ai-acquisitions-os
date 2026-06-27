const {
  isLikelyEmail,
  json,
  parseJsonBody,
  requirePost,
  safeTrim,
  truncate,
} = require("./_shared/security.cjs");

const MAX_SUBJECT_CHARS = 200;
const MAX_BODY_CHARS = 12000;

exports.handler = async (event) => {
  const methodResponse = requirePost(event);
  if (methodResponse) return methodResponse;

  const parsed = parseJsonBody(event);
  if (parsed.error) return json(400, { success: false, error: parsed.error });

  const to = safeTrim(parsed.body.to);
  const subject = truncate(parsed.body.subject, MAX_SUBJECT_CHARS);
  const message = truncate(parsed.body.body || parsed.body.message, MAX_BODY_CHARS);

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
