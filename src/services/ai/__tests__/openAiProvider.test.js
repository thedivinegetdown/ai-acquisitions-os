import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api", () => ({
  callNetlifyFunction: vi.fn(),
}));

import { callNetlifyFunction } from "../../api";
import {
  analyzeWithOpenAi,
  chatWithOpenAi,
  summarizeWithOpenAi,
} from "../openAiProvider";

describe("openAiProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes analysis through the Netlify AI analysis function", async () => {
    callNetlifyFunction.mockResolvedValue({
      success: true,
      data: { output_text: '{"summary":"Looks good"}' },
    });

    const result = await analyzeWithOpenAi({
      context: { deal: { id: "deal-1" } },
      fallback: { confidence: "Low" },
    });

    expect(result.success).toBe(true);
    expect(result.data.summary).toBe("Looks good");
    expect(callNetlifyFunction).toHaveBeenCalledWith(
      "ai-analysis",
      expect.objectContaining({ retries: 0 })
    );
  });

  it("routes summaries and chat through dedicated functions", async () => {
    callNetlifyFunction.mockResolvedValue({
      success: true,
      data: { output_text: "Summary text" },
    });

    await summarizeWithOpenAi({ context: { messages: [] } });
    await chatWithOpenAi({ question: "What next?", memory: [] });

    expect(callNetlifyFunction).toHaveBeenCalledWith(
      "ai-summary",
      expect.any(Object)
    );
    expect(callNetlifyFunction).toHaveBeenCalledWith(
      "ai-chat",
      expect.any(Object)
    );
  });

  it("rejects empty chat questions without calling the network", async () => {
    const result = await chatWithOpenAi({ question: "   " });

    expect(result.success).toBe(false);
    expect(callNetlifyFunction).not.toHaveBeenCalled();
  });
});
