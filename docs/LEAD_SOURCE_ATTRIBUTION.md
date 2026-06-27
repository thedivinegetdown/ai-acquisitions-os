# Lead Source Attribution

## Goal

Track where leads originate and create a foundation for measuring source quality before paid marketing integrations are added.

## Current Foundation

Epic 28 adds campaign and lead source services under `src/services/campaigns`:

- `leadSourceService`: normalizes lead sources and summarizes deal/campaign source counts.
- `attributionService`: calculates source coverage and unattributed deal counts.
- `campaignAnalyticsService`: calculates campaign funnel metrics and ROI.
- `campaignService`: normalizes manual campaign records.
- `campaignServiceFacade`: returns the UI-ready attribution analysis object.

## Current Attribution Model

Attribution is manual/internal only. It uses:

- Existing deal `source` fields
- Manually entered campaign lead source values
- Local campaign performance inputs

No paid ad platforms are connected.

## Supported Channels

- Direct mail
- PPC
- SEO
- Cold calling
- SMS campaign
- Referral
- Agent
- Organic
- Other

## Current Limitations

- Campaign records are local/manual and not persisted.
- Attribution is not enforced on lead intake yet.
- No UTM tracking exists yet.
- No paid platform APIs are integrated.
- No automation is triggered from campaign performance.

## Future Work

- Add persisted campaign records after schema approval.
- Add UTM and landing page attribution.
- Connect campaign IDs to lead intake.
- Add source-level ROI reports.
- Add permissioning for campaign settings.
- Add paid platform connectors only after server-side credential handling is approved.
