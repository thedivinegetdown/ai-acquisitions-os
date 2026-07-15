# AI Acquisitions OS

> A production-focused, AI-powered Real Estate Acquisition CRM built with React, Supabase, PostgreSQL, Netlify Functions, and modern cloud technologies.

---

## Overview

AI Acquisitions OS is a full-stack Customer Relationship Management (CRM) platform designed specifically for real estate acquisition teams.

The platform centralizes every stage of the acquisition process, from managing leads and communicating with sellers to analyzing deals and leveraging AI-assisted workflows, all within a single application.

The long-term vision is to replace multiple disconnected software tools with one scalable, enterprise-ready operating system.

---

## Key Features

### Lead & Deal Management

- Pipeline board
- Lead stages
- Search & filtering
- Deal cards
- Seller profiles

### Seller Workspace

- Complete seller information
- Activity timeline
- Notes
- Follow-up tracking
- Deal history

### AI-Assisted Workflows

- AI seller summaries
- Lead motivation analysis
- Next Best Action recommendations
- Conversation intelligence
- AI workflow foundation for future automation

### Communication Center

- SMS messaging
- Twilio integration
- Message history
- Personalized message templates
- Test mode for local development

### Deal Analysis

- Maximum Allowable Offer (MAO)
- Wholesale offer calculations
- Flip value estimation
- Cash flow analysis
- Comparable sales support

### Team Collaboration

- Acquisition representative assignments
- Team ownership
- Buyer management
- Activity tracking

---

# Technology Stack

## Frontend

- React
- Vite
- JavaScript (ES6+)
- HTML5
- CSS3

## Backend

- Netlify Functions
- Node.js
- REST APIs

## Database

- Supabase
- PostgreSQL

## Integrations

- Twilio
- OpenAI (foundation)
- Stripe (planned)
- Resend (planned)

## Development Tools

- Git
- GitHub
- VS Code
- Vitest
- ESLint

---

# Architecture

The application follows a modular architecture designed for scalability and maintainability.

```
src/

components/
pages/
hooks/
layouts/
services/
utils/
```

Core design principles include:

- Reusable React components
- Separation of concerns
- Custom hooks
- Modular architecture
- Scalable folder organization

---

# Project Status

Current Version

**v1.0.0**

Status

**Actively under development**

Completed

- Full React application
- Modular architecture
- Seller workspace
- Deal pipeline
- Message Center
- AI seller summaries
- Netlify Functions
- Supabase integration
- PostgreSQL database
- SMS logging
- Twilio integration
- Responsive UI

Currently In Progress

- Live production SMS
- Two-way messaging
- Persistent conversations
- AI Copilot enhancements

Planned

- Email integration
- Workflow automation
- AI negotiation assistant
- Mobile application
- Team permissions
- Analytics dashboard
- Enterprise features

---

# Screenshots

> Screenshots coming soon.

Recommended screenshots:

- Dashboard
- Pipeline Board
- Seller Workspace
- AI Summary
- Conversation Inbox
- Message Center
- Mobile View

---

# Getting Started

Clone the repository

```bash
git clone https://github.com/thedivinegetdown/ai-acquisitions-os.git
```

Install dependencies

```bash
npm install
```

Copy environment variables

```bash
cp .env.example .env
```

Run locally

```bash
netlify dev
```

---

# Environment Variables

Required variables include:

```
VITE_SUPABASE_URL=

VITE_SUPABASE_ANON_KEY=

SUPABASE_URL=

SUPABASE_SERVICE_ROLE_KEY=

TWILIO_ACCOUNT_SID=

TWILIO_AUTH_TOKEN=

TWILIO_PHONE_NUMBER=

OPENAI_API_KEY=
```

Never commit real API keys or `.env` files to source control.

---

# Future Roadmap

## Phase 1

Communication

- Live SMS
- Email
- Unified Inbox
- Attachments

## Phase 2

Automation

- AI follow-up campaigns
- Appointment reminders
- Workflow automation

## Phase 3

Artificial Intelligence

- AI Copilot
- Seller insights
- Offer recommendations
- Conversation analysis

## Phase 4

Enterprise

- Multi-user support
- Team permissions
- Role management
- Mobile application

---

# Why This Project?

This project was built to demonstrate modern full-stack software engineering principles while solving a real-world business problem.

It showcases:

- React application architecture
- Backend API development
- Database design
- Cloud deployment
- AI-assisted workflows
- Third-party API integration
- Serverless architecture
- Scalable software design

---

# License

This project is currently maintained as a private commercial software project.

© Adam Bermudez. All rights reserved.
