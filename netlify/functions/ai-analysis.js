const { createAiHandler } = require("./_shared/ai.cjs");

exports.handler = createAiHandler({
  defaultSystem: "You are a senior real estate acquisitions analyst.",
  promptLabel: "analysis prompt",
  temperature: 0.15,
});
