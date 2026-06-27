import { useEffect, useMemo, useState } from "react";
import { AI_PROVIDER_MODES } from "../../../services/ai";
import { analyzeCopilot, analyzeCopilotWithAi } from "../services";

export function useCopilot(input = {}) {
  const normalizedInput = useMemo(
    () =>
      ({
        ...input,
        messages: Array.isArray(input.messages) ? input.messages : [],
        tasks: Array.isArray(input.tasks) ? input.tasks : [],
      }),
    [
      input.deal,
      input.seller,
      input.messages,
      input.tasks,
      input.propertyInputs,
      input.buyers,
      input.transaction,
      input.sequenceDraft,
      input.providerMode,
    ]
  );

  const ruleBasedCopilot = useMemo(
    () => analyzeCopilot(normalizedInput),
    [normalizedInput]
  );
  const [copilot, setCopilot] = useState(ruleBasedCopilot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const providerMode = input.providerMode || AI_PROVIDER_MODES.HYBRID;

    setCopilot(ruleBasedCopilot);
    setError("");

    if (providerMode === AI_PROVIDER_MODES.RULE_BASED) {
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    async function loadAiCopilot() {
      setLoading(true);
      const aiCopilot = await analyzeCopilotWithAi({
        ...normalizedInput,
        providerMode,
      });

      if (!isMounted) return;

      setCopilot(aiCopilot);
      setError(aiCopilot.providerError || "");
      setLoading(false);
    }

    loadAiCopilot().catch((loadError) => {
      if (!isMounted) return;
      setCopilot({
        ...ruleBasedCopilot,
        fallbackUsed: true,
        providerError: loadError?.message || "AI provider unavailable.",
      });
      setError(loadError?.message || "AI provider unavailable.");
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [input.providerMode, normalizedInput, ruleBasedCopilot]);

  return {
    ...copilot,
    loading,
    error,
    providerMode: input.providerMode || AI_PROVIDER_MODES.HYBRID,
  };
}
