# Mobile Workflow Notes

## Purpose
This file documents the mobile-friendly workflow improvements and safe mobile/field-action shortcuts added during Mobile Sprint 25B/25C.

## What changed
- Added mobile-friendly shortcut toolbar in `src/components/ConversationThread.jsx`.
- Added safe copy/call shortcuts in `ConversationThread` and `src/components/DealModal.jsx`.
- Verified and preserved desktop behavior for all existing mobile features.
- Added `boxSizing: "border-box"` to key mobile cards so responsive width calculations are stable.
- Improved `SellerTasks.jsx` button layout for mobile screens by using flexible button widths.
- Ensured `CommunicationsHubPanel.jsx`, `CopilotPanel.jsx`, `OfferBuilder.jsx`, and `AIIntelligenceDashboard.jsx` have responsive containers and grid layouts.

## Mobile behavior guarantees
- No automated calls are triggered by mobile shortcut buttons.
- `Call Seller` uses `tel:` links so the user explicitly initiates a phone call.
- `Text Seller` focuses the reply box instead of sending anything automatically.
- `Open Conversation`, `View Next Best Action`, and `View AI Recommendation` scroll relevant content into view.
- AI outputs and communications drafts are never sent automatically by mobile UI actions.

## QA checklist
- [ ] `ConversationThread` actions are responsive and wrap on narrow widths.
- [ ] `DealModal` call button remains disabled until a valid phone is available.
- [ ] `SellerTasks` quick task buttons fit on one line only when enough width is available.
- [ ] `OfferBuilder`, `CopilotPanel`, `CommunicationsHubPanel`, `AIIntelligenceDashboard`, and `ExecutiveDashboard` render stable grids on mobile.
- [ ] Build passes: `npm run build`.
- [ ] Tests run successfully: `npm run test:run`.

## Notes for future cleanup
- Consider moving repeated responsive style helpers into shared layout utilities.
- Add a full responsive design pass once CSS modules or Tailwind are adopted.
