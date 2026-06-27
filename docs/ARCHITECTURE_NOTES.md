# Architecture Notes — Pre-AI Stabilization

## Purpose
This document captures the cleanup and stabilization approach used to prepare the repository for AI integration. OpenAI is now integrated server-side through Netlify Functions, while the UI continues to use provider abstractions and rule-based fallbacks.

## Key Principles
- Preserve existing functionality.
- Keep changes isolated to utility cleanup and safety improvements.
- Avoid database schema changes.
- Keep UI behavior unchanged unless fixing a bug.
- Strengthen service/hook/component boundaries without broad refactors.

## Areas of cleanup
- Consolidated repeated date formatting into `src/utils/dates.js`.
- Ensured shared utility usage for safe number, currency, and date handling.
- Removed transient `console.log` debug output from UI components.
- Left existing business logic in services and repositories.
- Kept components focused on rendering and user interactions.

## Recommended practices for future AI integration
- Keep AI orchestration inside services or feature-level hooks, not in presentational components.
- Use `src/utils/errors.js` to standardize user-safe error messages for any AI service errors.
- Prefer `formatSafeDate`, `parseSafeNumber`, and `toUserSafeError` across new code.
- Avoid introducing provider-specific API code directly into components.

## Notes on current utilities
- `src/utils/number.js` provides safe numeric parsing and percentage utilities.
- `src/utils/currency.js` formats USD values consistently.
- `src/utils/dates.js` normalizes date values and avoids invalid date output.
- `src/utils/dealFields.js` maps multiple field aliases to a single deal attribute access pattern.
- `src/utils/text.js` safely trims and normalizes string content.
