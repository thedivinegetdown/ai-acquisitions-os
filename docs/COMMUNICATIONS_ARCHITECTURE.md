# Communications Architecture

## Goal

Create one communication layer for seller interactions while keeping each provider isolated behind services.

## Current Channels

- SMS: active through the existing Twilio/Netlify/Supabase flow.
- Email: foundation only; drafts can be prepared but are not sent.
- Calling: foundation only; manual call notes can be logged but live calling is not active.
- Internal notes: local timeline events.
- Workflow, AI, transaction, voicemail: timeline-ready placeholders.

## Core Feature Structure

Communications Hub files live under:

- `src/features/communications/components`
- `src/features/communications/hooks`
- `src/features/communications/services`
- `src/features/communications/types`

Provider-specific services live under:

- `src/services/sms`
- `src/services/email`
- `src/services/calling`

## Timeline Model

All events are normalized into timeline cards with:

- Channel
- Direction
- Timestamp
- Sender
- Status
- Related deal
- Related workflow
- AI summary placeholder

Email draft events are added as local outbound draft events. Live email sending is not active.

Call log events are added as local call timeline events. Live calling is not active.

## Composer Model

The composer supports:

- SMS sending through the existing SMS service
- Internal notes
- Email drafts
- Manual call logs
- Future template drafts

Email drafts are editable and copyable only. SMS behavior is unchanged.
Call notes are logged locally only. Calling behavior does not place live calls.

## Provider Safety

- Provider secrets must stay server-side.
- Frontend code should call service gateways, not provider APIs directly.
- Future email sends should go through Netlify Functions.
- Future live calling should go through Netlify Functions or a backend service.
- No automatic seller communication should execute without explicit user action.

## Future Integrations

Future providers can be added behind the existing architecture:

- Email provider
- Phone provider
- Voicemail transcription
- WhatsApp
- Facebook Messenger
- Web chat

The UI should continue consuming normalized communication events rather than provider-specific payloads.
