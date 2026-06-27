# CSV Import Guide

## Purpose

CSV upload currently creates an intake preview only. It does not insert, update, overwrite, delete, message, or automate anything.

## Supported Columns

The intake parser supports these column names and common aliases:

- `seller name`
- `phone`
- `email`
- `property address`
- `city`
- `state`
- `zip`
- `lead source`
- `market`
- `asking price`
- `notes`

Underscore variants are also supported, such as:

- `seller_name`
- `property_address`
- `lead_source`
- `asking_price`

## Example

```csv
seller name,phone,email,property address,city,state,zip,lead source,market,asking price,notes
Jane Seller,555-555-1234,jane@example.com,123 Main St,Atlanta,GA,30301,Direct mail,Atlanta,225000,Wants a fast close
```

## Validation

The preview flags:

- Missing seller name
- Missing phone/email
- Missing property address
- Invalid phone
- Invalid email
- Possible duplicate
- Missing lead source
- Missing market

## Duplicate Detection

The preview checks for possible duplicates by:

- Normalized phone number
- Email
- Normalized property address

Duplicates are checked against currently loaded deals and within the uploaded CSV batch.

## Current Limitation

Import is intentionally preview-only until a safe persistence path, duplicate review workflow, and audit log are approved.
