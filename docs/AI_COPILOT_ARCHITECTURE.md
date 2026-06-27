# AI Copilot Architecture

## Goals

The AI Copilot provides acquisition guidance while preserving rule-based fallback behavior and keeping all OpenAI calls server-side.

## Flow

1. UI calls Copilot hooks/components.
2. Copilot services build a structured deal context.
3. `src/services/ai/aiGateway.js` chooses rule-based, OpenAI, or hybrid behavior.
4. OpenAI provider calls Netlify Functions through `src/services/api`.
5. Netlify Functions call OpenAI with server-side `OPENAI_API_KEY`.
6. Responses are parsed into stable UI-safe objects.
7. If OpenAI fails, hybrid mode returns rule-based fallback output.

## Key Modules

- `src/features/copilot/components/CopilotPanel.jsx`
- `src/features/copilot/hooks/useCopilot.js`
- `src/features/copilot/hooks/useCopilotChat.js`
- `src/features/copilot/providers/ruleBasedProvider.js`
- `src/features/copilot/providers/openAiProvider.js`
- `src/services/ai/aiGateway.js`
- `src/services/ai/openAiProvider.js`
- `src/services/ai/promptBuilder.js`
- `src/services/ai/responseParser.js`
- `src/services/ai/tokenEstimator.js`
- `src/services/ai/conversationMemory.js`

## Netlify AI Functions

- `netlify/functions/ai-chat.js`
- `netlify/functions/ai-analysis.js`
- `netlify/functions/ai-summary.js`

## Prompt System

Prompts live in `promptBuilder`, not UI components. Current prompt capabilities include seller summary, deal analysis, negotiation coaching, follow-up drafts, conversation summary, daily briefing, executive insights, and chat.

## Safety And Fallbacks

- OpenAI keys are never exposed to the client.
- Request bodies are validated server-side.
- Oversized prompts are rejected.
- Malformed AI responses are parsed into safe fallback shapes.
- Rule-based guidance remains available.
- AI guidance is internal, review-only, and not legal advice.
- Messages are not sent automatically.
