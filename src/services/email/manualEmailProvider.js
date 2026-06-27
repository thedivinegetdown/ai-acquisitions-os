import { createSuccess } from "../api";
import { normalizeEmailDraft } from "./emailParserService";

export const manualEmailProvider = {
  id: "manual",
  label: "Manual email draft provider",
  configured: true,
  async sendEmail(draft = {}) {
    const normalizedDraft = normalizeEmailDraft(draft);

    return createSuccess({
      messageId: `manual-email-${Date.now()}`,
      provider: "manual",
      status: "draft",
      fallbackMessage:
        "Email foundation only - live email sending is not active yet. Draft prepared for review.",
      draft: normalizedDraft,
    });
  },
};
