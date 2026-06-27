import { createSuccess } from "../api";
import { normalizeEmailDraft } from "./emailParserService";

export const mockEmailProvider = {
  id: "mock",
  label: "Mock email provider",
  configured: true,
  async sendEmail(draft = {}) {
    const normalizedDraft = normalizeEmailDraft(draft);

    return createSuccess({
      messageId: `mock-email-${Date.now()}`,
      provider: "mock",
      status: "provider-unavailable",
      fallbackMessage:
        "Mock email provider prepared a draft only. No email was sent.",
      draft: normalizedDraft,
    });
  },
};
