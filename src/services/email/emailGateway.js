import { analyzeAi } from "../ai/aiGateway";
import { createFailure, createSuccess } from "../api";
import { callNetlifyFunction } from "../api/netlifyClient";
import { manualEmailProvider } from "./manualEmailProvider";
import { mockEmailProvider } from "./mockEmailProvider";
import {
  buildAiEmailDraftFallback,
  buildEmailDraftFromTemplate,
} from "./emailTemplateService";
import {
  isLikelyEmail,
  normalizeEmailDraft,
  normalizeEmailMessage,
} from "./emailParserService";

const PROVIDERS = {
  manual: manualEmailProvider,
  mock: mockEmailProvider,
};

export function getEmailProvider(providerId = "manual") {
  return PROVIDERS[providerId] || manualEmailProvider;
}

export function getEmailProviderStatus(providerId = "manual") {
  const provider = getEmailProvider(providerId);

  return {
    providerId: provider.id,
    label: provider.label,
    configured: provider.configured,
    liveSendingActive: false,
    message: "Email foundation only - live email sending is not active yet.",
  };
}

export function createEmailDraft({
  to = "",
  subject = "",
  body = "",
  deal = {},
  source = "manual",
} = {}) {
  const draft = normalizeEmailDraft({
    to,
    subject,
    body,
    relatedDealId: deal?.id || deal?.deal_id || null,
    source,
  });

  if (!draft.body) {
    return createFailure(
      new Error("Email draft body is required."),
      "Email draft body is required."
    );
  }

  return createSuccess(draft);
}

export function createEmailDraftFromTemplate(input = {}) {
  return createSuccess(buildEmailDraftFromTemplate(input));
}

export async function createAiEmailDraft({
  deal = {},
  messages = [],
  to = "",
  prompt = "Draft a seller follow-up email.",
} = {}) {
  const fallbackDraft = buildAiEmailDraftFallback({ deal, to });
  const result = await analyzeAi({
    capability: "followUpDraft",
    context: { deal, messages, channel: "email", prompt },
    fallback: {
      summary: fallbackDraft.body,
      subject: fallbackDraft.subject,
      source: "emailTemplateFallback",
    },
  });

  const aiData = result.success ? result.data : {};

  return createSuccess(
    normalizeEmailDraft({
      to,
      subject: aiData.subject || fallbackDraft.subject,
      body: aiData.summary || aiData.body || fallbackDraft.body,
      relatedDealId: deal?.id || deal?.deal_id || null,
      source: "ai",
    }),
    {
      fallbackUsed: Boolean(aiData.fallbackUsed),
      provider: aiData.source || "aiGateway",
    }
  );
}

export async function prepareEmailDraft({
  to = "",
  subject = "",
  body = "",
  deal = {},
  providerId = "manual",
} = {}) {
  const draftResult = createEmailDraft({ to, subject, body, deal });
  if (!draftResult.success) return draftResult;

  const provider = getEmailProvider(providerId);
  return provider.sendEmail(draftResult.data);
}

export async function requestEmailSend({
  to = "",
  subject = "",
  body = "",
  dealId = null,
} = {}) {
  if (!isLikelyEmail(to)) {
    return createFailure(
      new Error("A valid recipient email is required."),
      "A valid recipient email is required."
    );
  }

  return callNetlifyFunction("send-email", {
    to,
    subject,
    body,
    dealId,
  });
}

export function buildEmailTimelineEvent(draft = {}, deal = null) {
  const message = normalizeEmailMessage({
    ...draft,
    id: `email-draft-${Date.now()}`,
    status: "draft",
    direction: "outbound",
    provider: "email-foundation",
  });

  return {
    id: message.id,
    channel: "email",
    direction: "outbound",
    timestamp: message.createdAt,
    formattedTimestamp: new Date(message.createdAt).toLocaleDateString(),
    sender: "Team",
    status: "draft",
    body: `${message.subject}: ${message.body}`,
    summary: "Email draft prepared. Live sending is not active.",
    relatedDealId: message.relatedDealId || deal?.id || null,
    relatedWorkflowId: null,
    sellerName: deal?.owner_name || deal?.seller_name || "",
    phone: deal?.phone || "",
    normalizedPhone: "",
    metadata: { emailDraft: message },
    source: "email_foundation",
  };
}
