const { createAiHandler } = require("./_shared/ai.cjs");

const handlerConfig = {
  defaultSystem: "You summarize CRM conversations for acquisitions teams.",
  promptLabel: "summary prompt",
  temperature: 0.1,
};

exports.createHandler = (dependencies) =>
  createAiHandler(handlerConfig, dependencies);
exports.handler = exports.createHandler();
