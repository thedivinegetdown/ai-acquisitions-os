const {
  json,
  parseJsonBody,
  requirePost,
  safeErrorMessage,
  truncate,
} = require("./security.cjs");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_PROMPT_CHARS = 28000;
const MAX_SYSTEM_CHARS = 4000;

function validatePrompt(body, promptLabel = "prompt") {
  if (!body || typeof body !== "object") return "Invalid request body.";
  if (!body.user || typeof body.user !== "string") return `Missing ${promptLabel}.`;
  if (body.user.length > MAX_PROMPT_CHARS) return "Prompt is too large.";
  if (body.system && typeof body.system !== "string") return "Invalid system prompt.";
  if (body.system && body.system.length > MAX_SYSTEM_CHARS) {
    return "System prompt is too large.";
  }
  return "";
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text;

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

async function callOpenAi({ system, user, defaultSystem, temperature }) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: truncate(system || defaultSystem, MAX_SYSTEM_CHARS),
        },
        {
          role: "user",
          content: truncate(user, MAX_PROMPT_CHARS),
        },
      ],
      temperature,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      response.status === 429
        ? "AI provider rate limit reached."
        : "AI provider request failed."
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function createAiHandler({
  defaultSystem,
  promptLabel,
  temperature,
}) {
  return async (event) => {
    const methodResponse = requirePost(event);
    if (methodResponse) return methodResponse;

    if (!process.env.OPENAI_API_KEY) {
      return json(503, {
        success: false,
        error: "AI provider is not configured.",
      });
    }

    const parsed = parseJsonBody(event);
    if (parsed.error) return json(400, { success: false, error: parsed.error });

    const validationError = validatePrompt(parsed.body, promptLabel);
    if (validationError) {
      return json(400, { success: false, error: validationError });
    }

    try {
      const result = await callOpenAi({
        ...parsed.body,
        defaultSystem,
        temperature,
      });

      return json(200, {
        success: true,
        output_text: extractOutputText(result),
        usage: result.usage || null,
        model: DEFAULT_MODEL,
      });
    } catch (error) {
      return json(error.status === 429 ? 429 : 502, {
        success: false,
        error: safeErrorMessage(error, "AI provider request failed."),
      });
    }
  };
}

module.exports = {
  createAiHandler,
};
