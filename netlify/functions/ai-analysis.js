const { createAiHandler } = require("./_shared/ai.cjs");

const handlerConfig = {
  defaultSystem: "You are a senior real estate acquisitions analyst.",
  promptLabel: "analysis prompt",
  temperature: 0.15,
};

exports.createHandler = (dependencies) =>
  createAiHandler(handlerConfig, dependencies);
exports.handler = exports.createHandler();
