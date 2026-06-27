# Calling Integration Plan

## Goal

Prepare AI Acquisitions OS for calling, call logging, voicemail notes, and call-based seller intelligence without enabling live calling yet.

## Current Foundation

Epic 24 adds a calling service layer:

- `callingGateway`: stable entry point for call logging and future provider calls.
- `manualCallProvider`: safe manual provider that never places live calls.
- `mockCallProvider`: provider-shaped mock for future testing.
- `callLogService`: normalizes call records and timeline events.
- `callSummaryService`: generates talking points, summarizes notes, detects objections, and recommends next actions.

Live calling is not active.

## Communications Hub Behavior

The Unified Communications Hub now supports:

- Manual call log entry
- Call notes
- Call outcome
- Next call date
- Call timeline events
- Call channel filter
- AI talking points
- AI call note summaries

The UI is labeled:

`Calling foundation only - live calling is not active yet.`

## Provider Architecture

The intended provider path is:

1. UI
2. Calling gateway
3. Manual/mock provider today
4. Future Netlify Function boundary
5. Future calling provider

Future calling providers should plug into `callingGateway` without requiring UI changes.

## AI Call Support

Current AI call support is draft/guidance only:

- Generate call talking points
- Summarize call notes
- Identify seller objections from notes
- Recommend next action

No automatic calls are placed.

## Safety Rules

- Do not expose calling provider secrets to frontend code.
- Do not place calls automatically.
- Do not auto-contact sellers.
- Call summaries are guidance only and should be reviewed by the user.

## Future Provider Plan

When a calling provider is selected:

1. Add server-side Netlify Functions for call initiation and webhooks.
2. Keep provider credentials server-side.
3. Validate phone numbers and consent rules server-side.
4. Add call persistence after a safe schema exists.
5. Add voicemail/transcription ingestion after provider selection.
6. Keep manual/mock providers as fallbacks.

## Known Limitations

- No live calling provider is connected.
- Call logs are local timeline events and not persisted.
- Voicemail transcription is not active.
- Call recording is not active.
- Consent/compliance enforcement is not implemented yet.
