# Billing Architecture

## Current Status

Billing is a foundation only. Live payments are not active, Stripe is not integrated, and usage limits are warning-only.

## Services

- `src/services/billing/billingService.js`
- `src/services/billing/planService.js`
- `src/services/billing/usageService.js`
- `src/services/billing/subscriptionService.js`
- `src/services/billing/index.js`

## Types

- `src/types/billing.ts`

Contracts include:

- `BillingPlan`
- `SubscriptionStatus`
- `UsageMetric`
- `UsageLimit`
- `InvoiceSummary`
- `BillingContext`

## Plans

Current foundational plans:

- Starter
- Growth
- Pro
- Enterprise

Each plan defines placeholder limits for:

- Leads
- SMS messages
- AI requests
- Team members
- Active markets
- Storage/documents

## UI

`src/components/BillingSubscriptionPanel.jsx` displays:

- Current plan
- Subscription status
- Usage summary
- Plan limits
- Upgrade recommendations
- Missing billing setup
- Future Stripe status

## Enforcement Boundary

This foundation does not:

- Collect payment information
- Create Stripe customers
- Create Stripe subscriptions
- Enforce usage limits globally
- Block product access
- Change tenant behavior

Usage limits should remain advisory until Stripe, tenant context, database schema, and entitlement checks are approved.
