import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const aiChat = require("../ai-chat.js");
const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

function authorization(rpc) {
  return vi.fn().mockResolvedValue({
    context: { organizationId: "org-1", role: "owner", userId: "user-1" },
    clients: { adminClient: { rpc } },
  });
}

function event(user = "Review this deal") {
  return { httpMethod: "POST", headers: {}, body: JSON.stringify({ user }) };
}

describe("organization provider policy", () => {
  it("fails closed when OpenAI is disabled for the organization", async () => {
    process.env.OPENAI_API_KEY = "test-provider-key";
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: false, reason: "provider-disabled" },
      error: null,
    });
    const providerRequest = vi.fn();
    const response = await aiChat.createHandler({
      authorize: authorization(rpc),
      providerRequest,
    })(event());

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).status).toBe("provider-disabled");
    expect(providerRequest).not.toHaveBeenCalled();
  });

  it("calls the provider only after the atomic organization cap permits it", async () => {
    process.env.OPENAI_API_KEY = "test-provider-key";
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, request_count: 1, monthly_request_cap: 10 },
      error: null,
    });
    const providerRequest = vi.fn().mockResolvedValue({ output_text: "safe" });
    const response = await aiChat.createHandler({
      authorize: authorization(rpc),
      providerRequest,
    })(event("12345"));

    expect(response.statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_organization_provider_request", {
      p_organization_id: "org-1",
      p_provider: "openai",
      p_prompt_characters: 5,
    });
    expect(providerRequest).toHaveBeenCalledTimes(1);
  });
});
