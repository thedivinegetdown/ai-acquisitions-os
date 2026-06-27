import { AI_PROVIDER_MODES } from "../../../services/ai";
import {
  openAiCopilotProvider,
  ruleBasedCopilotProvider,
} from "../providers";

export function analyzeCopilot(input = {}, provider = ruleBasedCopilotProvider) {
  return provider.analyze(input);
}

export async function analyzeCopilotWithAi(input = {}) {
  const fallback = ruleBasedCopilotProvider.analyze(input);
  const providerMode = input.providerMode || AI_PROVIDER_MODES.HYBRID;

  return openAiCopilotProvider.analyze(
    {
      ...input,
      providerMode,
    },
    fallback
  );
}
