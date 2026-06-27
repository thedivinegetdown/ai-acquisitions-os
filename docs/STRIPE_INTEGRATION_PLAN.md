# Stripe Integration Plan

## Goal

Add Stripe billing safely after the SaaS tenant foundation and billing data model are approved.

## Current Foundation

Epic 21 adds a test-mode Stripe boundary without activating subscription enforcement.

Implemented server functions:

- `create-checkout-session`: creates hosted Stripe Checkout sessions in subscription mode.
- `create-billing-portal-session`: creates hosted Stripe Billing Portal sessions for known test customers.
- `stripe-webhook`: verifies Stripe webhook signatures and normalizes received events.

Implemented client services:

- `stripeCheckoutService`: requests checkout sessions through Netlify Functions.
- `stripePortalService`: requests billing portal sessions through Netlify Functions.
- `stripePlanMapper`: maps internal plan IDs to Stripe price environment keys.
- `stripeWebhookService`: normalizes webhook-shaped payloads for future consumers.

Current safety posture:

- Stripe is test-mode only.
- Billing enforcement is not active.
- Usage limits remain warning-only.
- Payment details are never collected directly in the app.
- Frontend code only calls Netlify Functions through the service layer.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain server-side only.

## Phase 1: Data Model

Plan tables for:

- Billing customers
- Subscriptions
- Plans
- Entitlements
- Invoices
- Usage events
- Billing audit logs

Expected Stripe identifiers:

- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_price_id`
- `stripe_product_id`

## Phase 2: Server-Side Stripe Boundary

All Stripe calls should happen server-side through Netlify Functions or a backend service.

Current functions include:

- Create checkout session
- Create customer portal session
- Handle Stripe webhook

Future functions may include:

- Sync subscription status
- Record usage events

## Phase 3: Webhooks

Webhook handling should verify Stripe signatures and process:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Phase 4: Entitlements

Map subscription status and plan to entitlements:

- Lead limits
- SMS limits
- AI request limits
- Team member limits
- Market limits
- Document/storage limits

Initial rollout should warn only, then enforce after tenant isolation and audit logs are reliable.

## Phase 5: UI

Current UI:

- Billing / Subscription foundation panel can prepare hosted Stripe test checkout sessions.
- Billing portal session creation is available when a Stripe customer ID is supplied.
- The panel clearly states: "Stripe test integration only - billing enforcement is not active."

Future UI:

- Plan comparison
- Upgrade/downgrade workflow
- Invoice history
- Payment status
- Admin-only billing access

## Required Environment Variables

Server-side only:

- `STRIPE_SECRET_KEY`: Stripe test secret key.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret.
- `STRIPE_PRICE_STARTER`: Stripe test price ID for the Starter plan.
- `STRIPE_PRICE_GROWTH`: Stripe test price ID for the Growth plan.
- `STRIPE_PRICE_PRO`: Stripe test price ID for the Pro plan.
- `STRIPE_PRICE_ENTERPRISE`: optional Stripe test price ID for Enterprise, if checkout should be available.
- `APP_URL`: optional canonical app URL used for hosted Stripe return URLs.

## Safety Requirements

- Never expose Stripe secret keys to the client.
- Verify webhooks.
- Keep billing and tenant IDs linked server-side.
- Do not block access until subscription state is reliable.
- Preserve a manual override path for enterprise customers.
