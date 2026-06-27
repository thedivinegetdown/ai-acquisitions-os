# Action Inbox Plan

## Goal

Create an operational inbox that turns system signals into prioritized, reviewable actions.

## Current UI

The Action Inbox panel displays:

- Title
- Category
- Priority
- Related seller/deal
- Reason
- Recommended action
- Created date
- Status

It can group notifications by priority or category.

## Supported Shortcuts

Current shortcuts are safe view/local-state actions:

- Open seller workspace
- Open conversation
- View AI recommendation context
- View transaction checklist context
- View documents context
- View workflow approval context
- Mark as seen
- Mark as completed
- Snooze

Automation-related items are labeled `Requires approval`.

## Persistence

Notification state is local/manual for now. No notification state is saved to the database because there is not yet an approved notification persistence table.

## Future Work

- Add persisted notification records.
- Add tenant/user assignment.
- Add unread conversation state.
- Add workflow approval queue integration.
- Add due-date based snooze reminders.
- Add permissions for who can complete or dismiss notifications.
- Add audit logs for action inbox state changes.
