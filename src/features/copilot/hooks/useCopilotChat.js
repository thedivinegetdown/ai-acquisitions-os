import { useCallback, useState } from "react";
import {
  appendConversationMemory,
  chatWithAi,
  getConversationMemory,
} from "../../../services/ai";

function buildFallback(copilot = {}) {
  return {
    summary: copilot.summary,
    priority: copilot.priority,
    confidence: copilot.confidence,
    recommendation: copilot.recommendation,
    reasoning: copilot.reasoning,
    source: copilot.source,
    category: "Copilot Chat",
  };
}

export function useCopilotChat({
  copilot,
  deal,
  selectedPhone,
} = {}) {
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = useCallback(
    async (questionOverride) => {
      const nextQuestion = (questionOverride || question).trim();

      if (!nextQuestion || loading) {
        return null;
      }

      setLoading(true);
      setError("");
      setLastQuestion(nextQuestion);

      const memoryKey = deal?.id || selectedPhone || "global";
      const memory = getConversationMemory(memoryKey);
      const result = await chatWithAi({
        context: copilot?.context || {},
        question: nextQuestion,
        memory,
        fallback: buildFallback(copilot),
        providerMode: copilot?.providerMode,
      });

      if (!result.success) {
        setError(result.error?.message || "AI chat unavailable.");
        setLoading(false);
        return result;
      }

      appendConversationMemory(memoryKey, {
        role: "user",
        content: nextQuestion,
      });
      appendConversationMemory(memoryKey, {
        role: "assistant",
        content: result.data.summary,
      });

      setAnswer(result.data);
      setQuestion("");
      setLoading(false);
      return result;
    },
    [copilot, deal?.id, loading, question, selectedPhone]
  );

  const retry = useCallback(() => {
    if (!lastQuestion) return null;
    return ask(lastQuestion);
  }, [ask, lastQuestion]);

  return {
    question,
    setQuestion,
    lastQuestion,
    answer,
    loading,
    error,
    ask,
    retry,
    canRetry: Boolean(lastQuestion),
  };
}
