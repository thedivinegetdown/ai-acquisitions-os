# Notification Center

## Goal

Provide a centralized place to see what needs attention across leads, conversations, tasks, AI recommendations, workflows, transactions, buyers, documents, and system health.

## Current Foundation

Epic 30 adds notification services under `src/services/notifications`:

- `notificationRulesService`: creates notification candidates from loaded deals and system health.
- `notificationPriorityService`: standardizes priority and status handling.
- `notificationService`: groups, counts, and summarizes active notifications.
- `actionInboxService`: exposes local/manual actions such as seen, completed, dismissed, and snoozed.

## Included Notification Categories

- Follow-ups due
- Overdue tasks
- Critical leads
- Deals missing key data
- Offers ready for review
- Transactions needing attention
- Documents missing information
- Buyer matches needing review
- Workflow approvals pending
- System health warnings

Unread seller message state is noted as a future capability because unread state is not currently persisted.

## Priority

- Low
- Medium
- High
- Critical

## Status

- New
- Seen
- Snoozed
- Completed
- Dismissed

## Safety

The notification center does not:

- Send SMS
- Send email
- Place calls
- Run AI automatically
- Execute workflows
- Delete or modify database records

Only local/manual notification state changes are supported.
