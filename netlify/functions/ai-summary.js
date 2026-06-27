const { createAiHandler } = require("./_shared/ai.cjs");

exports.handler = createAiHandler({
  defaultSystem: "You summarize CRM conversations for acquisitions teams.",
  promptLabel: "summary prompt",
  temperature: 0.1,
});
