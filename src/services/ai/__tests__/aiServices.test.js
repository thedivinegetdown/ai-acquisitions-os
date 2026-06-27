import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../openAiProvider", () => ({
  analyzeWithOpenAi: vi.fn(),
  chatWithOpenAi: vi.fn(),
  summarizeWithOpenAi: vi.fn(),
}));

import { analyzeWithOpenAi, chatWithOpenAi } from "../openAiProvider";
import { AI_PROVIDER_MODES, analyzeAi, chatWithAi } from "../aiGateway";
import { parseAiResponse } from "../responseParser";
import {
  estimateTokens,
  trimContextForAi,
  trimMessagesForTokenBudget,
} from "../tokenEstimator";

describe("aiGateway fallback behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rule fallback in rule-based mode", async () => {
    const result = await analyzeAi({
      providerMode: AI_PROVIDER_MODES.RULE_BASED,
      fallback: {
        summary: "Rule summary",
        source: "rule",
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.summary).toBe("Rule summary");
    expect(result.data.fallbackUsed).toBe(true);
    expect(analyzeWithOpenAi).not.toHaveBeenCalled();
  });

  it("falls back when OpenAI analysis fails in hybrid mode", async () => {
    analyzeWithOpenAi.mockResolvedValue({
      success: false,
      error: { message: "AI unavailable" },
    });

    const result = await analyzeAi({
      providerMode: AI_PROVIDER_MODES.HYBRID,
      fallback: {
        summary: "Fallback summary",
        source: "rule",
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.summary).toBe("Fallback summary");
    expect(result.data.fallbackUsed).toBe(true);
    expect(result.data.providerError).toBe("AI unavailable");
  });

  it("falls back for chat failures in hybrid mode", async () => {
    chatWithOpenAi.mockResolvedValue({
      success: false,
      error: { message: "Rate limited" },
    });

    const result = await chatWithAi({
      providerMode: AI_PROVIDER_MODES.HYBRID,
      question: "What next?",
      fallback: {
        summary: "Call seller",
        recommendation: "Follow up",
      },
    });

    expect(result.success).toBe(true);
    expect(result.data.summary).toBe("Call seller");
    expect(result.data.fallbackUsed).toBe(true);
  });
});

describe("responseParser", () => {
  it("returns safe fallback data for malformed responses", () => {
    const parsed = parseAiResponse(
      { output_text: "not json, but useful" },
      { recommendation: "Review manually" }
    );

    expect(parsed.summary).toBe("not json, but useful");
    expect(parsed.recommendation).toBe("Review manually");
    expect(parsed.confidence).toBe("Medium");
  });

  it("parses embedded JSON responses", () => {
    const parsed = parseAiResponse({
      output_text: 'Here: {"summary":"Good deal","risks":["Missing repairs"]}',
    });

    expect(parsed.summary).toBe("Good deal");
    expect(parsed.risks).toEqual(["Missing repairs"]);
  });
});

describe("tokenEstimator", () => {
  it("estimates and trims messages safely", () => {
    expect(estimateTokens("abcd")).toBe(1);

    const messages = Array.from({ length: 10 }, (_, index) => ({
      id: index,
      message: "x".repeat(100),
    }));
    const trimmed = trimMessagesForTokenBudget(messages, 80);

    expect(trimmed.length).toBeLessThan(messages.length);
    expect(trimmed.at(-1).id).toBe(9);
  });

  it("trims oversized context while preserving key sections", () => {
    const context = {
      deal: { id: 1 },
      seller: { name: "Jane" },
      conversation: {
        analysis: { sentiment: "warm" },
        messages: Array.from({ length: 100 }, (_, index) => ({
          id: index,
          message: "x".repeat(200),
        })),
      },
      tasks: Array.from({ length: 50 }, (_, index) => ({ id: index })),
    };

    const trimmed = trimContextForAi(context, 200);

    expect(trimmed.deal).toEqual({ id: 1 });
    expect(trimmed.tasks.length).toBeLessThanOrEqual(20);
    expect(trimmed.conversation.messages.length).toBeLessThan(100);
  });
});
