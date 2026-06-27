export {
  buildEmailTimelineEvent,
  createAiEmailDraft,
  createEmailDraft,
  createEmailDraftFromTemplate,
  getEmailProvider,
  getEmailProviderStatus,
  prepareEmailDraft,
  requestEmailSend,
} from "./emailGateway";
export { manualEmailProvider } from "./manualEmailProvider";
export { mockEmailProvider } from "./mockEmailProvider";
export {
  EMAIL_TEMPLATES,
  buildAiEmailDraftFallback,
  buildEmailDraftFromTemplate,
  getEmailTemplate,
} from "./emailTemplateService";
export {
  isLikelyEmail,
  normalizeEmailAddress,
  normalizeEmailDraft,
  normalizeEmailMessage,
} from "./emailParserService";
