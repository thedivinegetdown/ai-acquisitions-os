import { safeTrim } from "../../utils/text";

export function normalizeEmailAddress(value = "") {
  return safeTrim(value).toLowerCase();
}

export function isLikelyEmail(value = "") {
  const normalized = normalizeEmailAddress(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function normalizeEmailDraft(draft = {}) {
  return {
    to: normalizeEmailAddress(draft.to),
    subject: safeTrim(draft.subject) || "Follow up",
    body: safeTrim(draft.body),
    templateId: safeTrim(draft.templateId),
    relatedDealId: draft.relatedDealId || draft.dealId || null,
    generatedAt: draft.generatedAt || new Date().toISOString(),
    source: draft.source || "manual",
  };
}

export function normalizeEmailMessage(message = {}) {
  const draft = normalizeEmailDraft(message);

  return {
    id: message.id || `email-${Date.now()}`,
    ...draft,
    from: normalizeEmailAddress(message.from),
    status: message.status || "draft",
    direction: message.direction || "outbound",
    createdAt: message.createdAt || message.created_at || draft.generatedAt,
    provider: message.provider || "manual",
  };
}
