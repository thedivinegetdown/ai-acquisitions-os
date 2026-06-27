# Campaign Tracking Plan

## Goal

Create a manual campaign performance foundation that can later connect to real marketing attribution and paid ad platforms.

## Current UI

The Campaign Tracking panel supports:

- Campaign name
- Lead source
- Market
- Channel
- Start date
- End date
- Budget
- Leads generated
- Qualified leads
- Offers made
- Contracts signed
- Deals closed
- Estimated revenue
- Notes

The panel is labeled:

`Campaign tracking foundation - manual/internal attribution only.`

## Metrics

The campaign services calculate:

- Cost per lead
- Cost per qualified lead
- Offer rate
- Contract rate
- Close rate
- Estimated ROI
- Best performing source
- Underperforming source

## Persistence

Campaigns are local/manual for now. No campaign records are saved to the database because there is not yet an approved campaign persistence pattern.

## Safety Rules

- Do not trigger SMS, email, AI automation, or workflows from campaign analytics.
- Do not connect paid ad platforms yet.
- Do not overwrite lead source fields automatically.
- Do not infer revenue without user-entered or existing available data.

## Future Integration Path

1. Add campaign tables and audit logs after schema approval.
2. Connect lead intake records to campaigns.
3. Add UTM capture and source attribution rules.
4. Add server-side provider functions for paid ad platforms.
5. Add dashboard widgets for campaign ROI and source quality.
6. Add data-quality checks for unattributed leads.
