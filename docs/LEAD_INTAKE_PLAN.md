# Lead Intake Plan

## Goal

Create a safe foundation for importing seller leads and standardizing deal records from manual entry or CSV upload.

## Current Foundation

Epic 27 adds lead intake services under `src/services/leadIntake`:

- `leadImportService`: orchestrates manual lead and CSV preview analysis.
- `leadNormalizationService`: normalizes seller names, phone numbers, email, addresses, source, market, and asking price.
- `leadValidationService`: returns validation warnings for missing or malformed fields.
- `duplicateLeadService`: checks possible duplicates against existing deals and within the preview batch.

The existing `LeadImporter` component has been converted from direct CSV insert behavior to preview-only intake.

## Current Behavior

The Lead Import / Intake panel supports:

- Manual lead entry
- CSV upload preview
- Field validation
- Duplicate detection
- Normalized phone numbers
- Normalized seller names
- Normalized property addresses
- Lead source selection
- Market entry
- Explicit review confirmation

No records are inserted into the database in this foundation.

## Validation Warnings

Warnings include:

- Missing seller name
- Missing phone/email
- Missing property address
- Invalid phone
- Invalid email
- Possible duplicate
- Missing lead source
- Missing market

## Import Safety

- No automatic imports.
- No existing deals are overwritten.
- No existing records are deleted.
- No SMS, email, AI automation, or workflows are triggered.
- Confirmation currently records review intent only and does not persist data.

## Future Work

Before enabling database import:

1. Add a dedicated lead intake repository/service.
2. Confirm the canonical deals schema and required fields.
3. Add server-side validation for CSV imports.
4. Add duplicate merge/review workflow.
5. Add audit logging.
6. Add permissions for who can import leads.
7. Add tests around persistence and duplicate handling.
