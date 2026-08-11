const { createAiHandler } = require("./_shared/ai.cjs");

const handlerConfig = {
  defaultSystem: "You are a helpful acquisitions copilot.",
  promptLabel: "user prompt",
  temperature: 0.2,
};

exports.createHandler = (dependencies) =>
  createAiHandler(handlerConfig, dependencies);
exports.handler = exports.createHandler();
