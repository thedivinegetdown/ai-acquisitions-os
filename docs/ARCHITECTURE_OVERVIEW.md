# Architecture Overview

## Stack

- React
- Vite
- TypeScript contracts for service boundaries
- Supabase
- Netlify Functions
- Twilio
- OpenAI through server-side Netlify Functions

## Folder Model

- `src/components`: shared and legacy UI components.
- `src/features`: larger product areas with components, hooks, services, and types.
- `src/services`: reusable business logic, providers, repositories, API clients, logging, monitoring, cache, and config.
- `src/utils`: pure helpers for numbers, currency, dates, phone, text, errors, async state, and notifications.
- `src/types`: stable TypeScript contracts for future migration.
- `netlify/functions`: server-side integration boundary for Twilio and OpenAI.
- `docs`: product, architecture, deployment, and roadmap documentation.

## Architectural Principles

- UI renders analysis objects and calls hooks/services.
- Business logic belongs in services.
- External provider calls stay server-side or behind service abstractions.
- Rule-based engines remain available as fallbacks for AI-assisted systems.
- Large feature areas are lazy-loaded with React Suspense to keep the initial bundle smaller.

## Cross-Cutting Services

- `src/services/api`: centralized Netlify Function client and service result contracts.
- `src/services/logging`: structured logger with development-only debug logs.
- `src/services/monitoring`: timing and event hooks for future observability providers.
- `src/services/cache`: small in-memory TTL cache for safe derived reads.
- `src/services/config`: client environment access and validation.

## Serverless Boundaries

- `send-sms.cjs`: outbound SMS through Twilio.
- `inbound-v2.cjs`: inbound SMS webhook handler.
- `ai-chat.js`: contextual AI copilot chat.
- `ai-analysis.js`: AI analysis endpoint.
- `ai-summary.js`: AI summary endpoint.
