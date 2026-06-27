# Email Integration Plan

## Goal

Prepare AI Acquisitions OS for seller email communication without disrupting the active SMS system.

## Current Foundation

Epic 23 adds a draft-only email architecture:

- `emailGateway`: stable entry point for email draft preparation and future provider calls.
- `manualEmailProvider`: prepares local drafts only.
- `mockEmailProvider`: supports provider-shaped test behavior without sending.
- `emailTemplateService`: reusable seller follow-up, offer follow-up, and nurture templates.
- `emailParserService`: normalizes email addresses, drafts, and messages.
- `send-email` Netlify Function: validates requests and returns safe provider-unavailable responses unless a future provider is configured.

Live email sending is not active.

## Communications Hub Behavior

The Unified Communications Hub now supports:

- Email draft channel
- Email recipient field
- Email subject field
- Copyable drafts
- AI email draft generation through the existing AI gateway
- Email timeline draft events
- Existing email channel filter
- Future provider status label

The UI is labeled:

`Email foundation only - live email sending is not active yet.`

## Provider Architecture

The intended provider path is:

1. UI
2. Email gateway
3. Manual/mock provider today
4. Netlify Function boundary
5. Future email provider

Future providers should plug into `emailGateway` without requiring UI changes.

## Safety Rules

- Do not expose provider secrets to frontend code.
- Do not send automatic emails.
- Do not replace SMS.
- Drafts must remain editable and copyable before use.
- Provider errors must return user-safe messages.

## Future Provider Plan

When a provider is selected:

1. Add server-side provider implementation behind `netlify/functions/send-email.js`.
2. Keep provider API keys in Netlify environment variables.
3. Validate recipient, subject, and body server-side.
4. Add audit logging and persistence after a safe email schema exists.
5. Add delivery status webhooks after the provider is chosen.
6. Keep manual/mock providers as fallbacks.

## Known Limitations

- No live email provider is connected.
- Email drafts are local and not persisted.
- No inbound email ingestion exists yet.
- No delivery status tracking exists yet.
- AI draft output is advisory and must be reviewed before use.
