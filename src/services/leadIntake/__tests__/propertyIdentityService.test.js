import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildVolusiaVerifiedPropertyIdentity,
  normalizeVerifiedPropertyIdentity,
  propertyIdentityKey,
} from "../propertyIdentityService";

const migration = readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "202610150001_add_canonical_property_identity.sql"),
  "utf8"
).toLowerCase();

describe("canonical property identity", () => {
  it("accepts only an exact server-verified seven-digit Volusia PARID", () => {
    const verified = buildVolusiaVerifiedPropertyIdentity({
      status: "matched",
      source: "volusia-parcel-ownership",
      propertyVerificationState: "PARCEL_VERIFIED",
      verifiedParcelId: "2123541",
      retrievedAt: "2026-10-15T12:00:00Z",
      parcel: { parcelId: "2123541" },
    });
    expect(verified).toEqual({
      jurisdiction: "us-fl-volusia-county",
      authoritativeParcelId: "2123541",
      verificationSource: "volusia-parcel-ownership",
      verifiedAt: "2026-10-15T12:00:00.000Z",
    });
    expect(propertyIdentityKey(verified)).toBe("us-fl-volusia-county:2123541");

    for (const result of [
      { status: "unmatched", propertyVerificationState: "UNVERIFIED" },
      { status: "ambiguous", propertyVerificationState: "UNVERIFIED" },
      {
        status: "matched", source: "volusia-parcel-ownership",
        propertyVerificationState: "PARCEL_VERIFIED", verifiedParcelId: "21-23541",
        retrievedAt: "2026-10-15T12:00:00Z", parcel: { parcelId: "21-23541" },
      },
      {
        status: "matched", source: "volusia-parcel-ownership",
        propertyVerificationState: "PARCEL_VERIFIED", verifiedParcelId: "2123541",
        retrievedAt: "2026-10-15T12:00:00Z", parcel: { parcelId: "7654321" },
      },
    ]) {
      expect(buildVolusiaVerifiedPropertyIdentity(result)).toBeNull();
    }
  });

  it("keeps jurisdictions distinct and rejects unsupported identity input", () => {
    const when = "2026-10-15T12:00:00Z";
    expect(propertyIdentityKey({
      jurisdiction: "us-fl-orange-county", authoritativeParcelId: "302430266507203",
      verificationSource: "orange-county-property-appraiser", verifiedAt: when,
    })).not.toBe(propertyIdentityKey({
      jurisdiction: "us-fl-volusia-county", authoritativeParcelId: "2123541",
      verificationSource: "volusia-parcel-ownership", verifiedAt: when,
    }));
    expect(normalizeVerifiedPropertyIdentity({
      jurisdiction: "us-fl-volusia-county", authoritativeParcelId: "2123541",
      verificationSource: "seller-input", verifiedAt: when,
    })).toBeNull();
  });

  it("defines durable active uniqueness, history preservation, and fail-closed migration audit", () => {
    expect(migration).toContain("create table if not exists public.property_identities");
    expect(migration).toContain("constraint property_identities_natural_key");
    expect(migration).toContain("create unique index if not exists deals_one_active_verified_property_uidx");
    expect(migration).toContain("not in ('closed', 'dead lead')");
    expect(migration).toContain("create table if not exists public.deal_intake_sources");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("on conflict (organization_id, jurisdiction, authoritative_parcel_id) do nothing");
    expect(migration).toContain("owner disposition is required; no migration changes were applied");
    expect(migration).not.toMatch(/delete from public\.deals|drop table|truncate/);
  });
});
