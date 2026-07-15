# AI Acquisitions OS

A production-focused Real Estate Acquisition CRM built with React, Vite, Supabase, Netlify Functions, and AI-powered workflows.

---

# Vision

AI Acquisitions OS is designed to become a complete acquisitions platform for real estate investors.

The goal is to eliminate the need for multiple software subscriptions by combining:

- CRM
- Lead Management
- Deal Analysis
- AI Decision Making
- Seller Communication
- Buyer Management
- Automation
- Analytics

into one unified operating system.

---

# Technology Stack

Frontend
- React
- Vite

Backend
- Netlify Functions

Database
- Supabase (PostgreSQL)

Authentication
- Supabase Auth (future)

Deployment
- Netlify

Communication
- Twilio (SMS)
- Resend (Email - planned)

AI
- OpenAI integration (planned)

---

# Current Architecture

## Refactor Completed

The project was refactored from a large monolithic App.jsx into a modular architecture.

Created:

```
src/
│
├── components/
├── hooks/
├── layouts/
├── pages/
└── utils/
```

---

## App Refactor

Previous

- 500+ line App.jsx

Current

App.jsx now delegates rendering through modular architecture.

Created:

- AppLayout.jsx
- AppSections.jsx
- useDealData.js

Benefits

- cleaner architecture
- reusable components
- easier testing
- scalable

---

# Features Completed

## Dashboard

- Deal Cards
- Pipeline
- Filters
- Search
- Lead Stages

---

## AI Insights

Displays

- Lead Score
- Motivation
- AI Summary
- Next Best Action

---

## Deal Analyzer

Calculates

- MAO
- Wholesale Offer
- Flip Value
- Cashflow

---

## Offer Engine

Supports

- Cash Offer
- Wholesale Offer
- Seller Finance

---

## Negotiation Tracker

Tracks

- Asking Price
- Offer
- Counter Offer
- Status

---

## Comps Engine

Stores

- Comparable Sales
- Average Value
- Suggested ARV

---

## Team Panel

Assigns

- Owner
- Acquisition Rep
- Disposition Rep

---

## Follow-Up Tasks

Stores

- Notes
- Due Dates
- Task Type

---

## Follow-Up Sequence

Sequence generator

(Currently placeholder)

---

## Buyer Matches

Buyer matching engine

(Currently placeholder)

---

## Buyer Blast

Generates buyer blast messages

Example

- Address
- ARV
- Repairs
- Strategy

---

## Document Vault

Stores

- Purchase Agreements
- Title Docs
- Notes
- URLs

---

## Activity Timeline

Tracks

- Calls
- Notes
- Activities

---

# Message Center

The old Seller Communications Hub has been removed.

New Message Center now supports

- SMS drafting
- Character count
- Send button
- Send history
- Deal-specific personalization

Future

- Email
- MMS
- Attachments
- AI-generated messages

---

# Netlify Functions

Created

```
netlify/functions/send-sms.js
```

Purpose

Handles

- SMS sending
- Test Mode
- Twilio integration
- Message logging

Current behavior

If Twilio Number exists

- sends real SMS

If Twilio Number missing

- runs in Test Mode
- still logs message

---

# Supabase

Created table

```
message_logs
```

Columns

- id
- deal_id
- phone
- message
- channel
- status
- created_at

Purpose

Stores permanent communication history.

---

# Environment Variables

Required

```
TWILIO_ACCOUNT_SID=

TWILIO_AUTH_TOKEN=

TWILIO_PHONE=

VITE_SUPABASE_URL=

SUPABASE_SERVICE_ROLE_KEY=
```

---

# Twilio Status

Completed

- Account Created
- SID obtained
- Auth Token obtained

Pending

- Purchase Twilio Number

Until purchased

SMS runs in Test Mode.

---

# Current Development Status

Completed

✅ Refactor

✅ Modular Architecture

✅ Deal Modal

✅ AI Insights

✅ Offer Engine

✅ Negotiation Tracker

✅ Team Panel

✅ Comps

✅ Buyer Blast

✅ Message Center

✅ Netlify Function

✅ Supabase Logging

In Progress

⚠ Live Twilio SMS

⚠ Persistent Message History

Planned

- Resend Email
- Two-way Messaging
- Auto Follow-Up
- AI Seller Assistant
- Workflow Automation

---

# Future Roadmap

Phase 1

Communication

- Live SMS
- Email
- Inbox
- History

Phase 2

Automation

- Follow-up campaigns
- Appointment reminders
- AI reminders

Phase 3

AI

- Seller Analysis
- Offer Suggestions
- Objection Handling
- AI Copilot

Phase 4

CRM

- Multi-user
- Permissions
- Roles
- Teams

Phase 5

Analytics

- KPIs
- Conversion Rates
- Revenue Dashboard
- Pipeline Metrics

Phase 6

Enterprise

- Mobile
- Notifications
- Calling
- Documents
- Integrations

---

# Project Goals

Build the best AI-powered Real Estate Acquisition Operating System capable of replacing multiple CRM and acquisitions tools while providing a modern, scalable, enterprise-grade experience.

---

# Development Principles

Every new feature should be

- Modular
- Reusable
- Tested
- Production Ready
- Mobile Friendly
- Scalable
- Secure

Avoid

- Large monolithic components
- Duplicate logic
- Hardcoded values
- Tight coupling

Always prefer

- Composition
- Custom Hooks
- Reusable Components
- Separation of Concerns

---

# Current Version

v0.7.0

Status

Actively under development.
Communication engine and automation system currently being implemented.
