import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  assertProductionTarget,
  assertReadOnlyRequest,
  inspectOpenApi,
  parseContentRange,
  resolveProductionTarget,
} = require("../inspect-production-tenant-readiness.cjs");
const root = process.cwd();
const inspectionSql = readFileSync(
  path.join(root, "supabase", "security", "production_readiness_inspection.sql"),
  "utf8"
).toLowerCase();
const backfillSql = readFileSync(
  path.join(root, "supabase", "security", "production_backfill_template.sql"),
  "utf8"
).toLowerCase();

describe("EO-PROD-01 production inspection safety", () => {
  it("requires explicit read-only authorization and a production Supabase host", () => {
    expect(() => assertProductionTarget("https://project.supabase.co", "false")).toThrow(
      "EO_PROD_READ_ONLY=true"
    );
    expect(() => assertProductionTarget("http://127.0.0.1:54321", "true")).toThrow(
      "production Supabase"
    );
    expect(assertProductionTarget("https://project.supabase.co", "true")).toBe(
      "https://project.supabase.co"
    );
  });

  it.each(["GET", "HEAD"])("permits read-only HTTP %s", (method) => {
    expect(() => assertReadOnlyRequest(method, "/rest/v1/deals")).not.toThrow();
  });

  it("requires server and public Supabase URLs to identify the same project", () => {
    expect(() =>
      resolveProductionTarget({
        EO_PROD_READ_ONLY: "true",
        SUPABASE_URL: "https://server-project.supabase.co",
        VITE_SUPABASE_URL: "https://other-project.supabase.co",
      })
    ).toThrow("origins do not match");
    expect(
      resolveProductionTarget({
        EO_PROD_READ_ONLY: "true",
        SUPABASE_URL: "https://same-project.supabase.co",
        VITE_SUPABASE_URL: "https://same-project.supabase.co",
      })
    ).toBe("https://same-project.supabase.co");
  });

  it.each([
    "tenant_table_ownership_report",
    "tenant_rls_readiness_report",
    "tenant_rls_is_ready",
  ])("permits only the stable reporting RPC %s", (name) => {
    expect(() => assertReadOnlyRequest("POST", `/rest/v1/rpc/${name}`)).not.toThrow();
  });

  it.each(["PUT", "PATCH", "DELETE"])("blocks production HTTP %s", (method) => {
    expect(() => assertReadOnlyRequest(method, "/rest/v1/deals")).toThrow(
      "Blocked non-read-only"
    );
  });

  it("blocks non-reporting RPCs", () => {
    expect(() =>
      assertReadOnlyRequest("POST", "/rest/v1/rpc/create_personal_organization")
    ).toThrow("Blocked non-read-only");
  });

  it("parses exact PostgREST counts without row contents", () => {
    expect(parseContentRange("0-0/42")).toBe(42);
    expect(parseContentRange("*/0")).toBe(0);
    expect(parseContentRange("0-0/*")).toBeNull();
  });

  it("reports missing committed tables and columns from REST metadata", () => {
    const report = inspectOpenApi({
      definitions: { organizations: { properties: { id: {}, name: {} } } },
    });
    expect(report.missingTables).toContain("deals");
    expect(report.missingColumns).toContain("organizations.status");
  });

  it("contains no credential literals or unrestricted request methods", () => {
    const source = readFileSync(
      path.join(root, "scripts", "inspect-production-tenant-readiness.cjs"),
      "utf8"
    );
    expect(source).not.toMatch(/sb_secret_|service_role\.[A-Za-z0-9]/);
    expect(source).not.toContain('method: "PATCH"');
    expect(source).not.toContain('method: "DELETE"');
    expect(source).not.toContain('method: "PUT"');
  });

  it("keeps the SQL inspection artifact transaction-level read-only", () => {
    expect(inspectionSql).toContain("begin transaction read only");
    expect(inspectionSql).toContain("set transaction read only");
    expect(inspectionSql.trimEnd().endsWith("rollback;")).toBe(true);
    expect(inspectionSql).not.toMatch(
      /\b(insert|update|delete|upsert|alter|create|drop|truncate|grant|revoke)\b/
    );
  });

  it("requires explicit target organization, name, and owner placeholders", () => {
    expect(backfillSql).toContain("replace_with_target_organization_uuid");
    expect(backfillSql).toContain("replace_with_exact_organization_name");
    expect(backfillSql).toContain("replace_with_active_owner_user_uuid");
    expect(backfillSql).toContain("all explicit production ownership placeholders must be replaced");
  });

  it("preserves non-null ownership and refuses conflicts", () => {
    expect(backfillSql).toContain("existing non-null ownership conflicts");
    expect(backfillSql.match(/where (?:child\.)?organization_id is null/g)?.length).toBeGreaterThanOrEqual(8);
    expect(backfillSql).not.toMatch(/set organization_id[^;]+where organization_id is not null/s);
  });

  it("refuses unknown or ownerless organizations and child mismatches", () => {
    expect(backfillSql).toContain("target organization is unknown, inactive, or has a name mismatch");
    expect(backfillSql).toContain("does not have the explicit active owner membership");
    expect(backfillSql).toContain("child/deal ownership or relationship mismatch blocks backfill");
    expect(backfillSql).toContain("backfill verification found cross-tenant child relationships");
  });

  it("defaults to rollback and contains no destructive or RLS activation SQL", () => {
    expect(backfillSql.trimEnd().endsWith("rollback;")).toBe(true);
    expect(backfillSql).not.toMatch(/\b(delete|truncate|drop)\b/);
    expect(backfillSql).not.toMatch(/enable\s+row\s+level\s+security/);
    expect(backfillSql).not.toMatch(/\bcommit\s*;/);
  });

  it("contains no credential material in rollout artifacts", () => {
    const artifacts = [
      inspectionSql,
      backfillSql,
      readFileSync(
        path.join(root, "docs", "security", "PRODUCTION_RLS_ACTIVATION_RUNBOOK.md"),
        "utf8"
      ),
    ].join("\n");
    expect(artifacts).not.toMatch(/sb_secret_|eyj[a-z0-9_-]+\.eyj[a-z0-9_-]+\./i);
    expect(artifacts).not.toMatch(/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i);
  });
});
