const { createAiHandler } = require("./_shared/ai.cjs");

exports.handler = createAiHandler({
  defaultSystem: "You are a helpful acquisitions copilot.",
  promptLabel: "user prompt",
  temperature: 0.2,
});
