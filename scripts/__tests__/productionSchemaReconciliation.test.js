import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { assertSafeTarget, committedCandidate } = require("../test-production-schema-reconciliation.cjs");
const root = process.cwd();
const sql = readFileSync(path.join(root,"supabase","security","production_schema_reconciliation.sql"),"utf8");
const fixture = readFileSync(path.join(root,"supabase","tests","eo_prod_02_legacy_fixture.sql"),"utf8");
const assertions = readFileSync(path.join(root,"supabase","tests","eo_prod_02_reconciliation_assertions.sql"),"utf8");

describe("EO-PROD-02 reconciliation safety", () => {
  it("defaults to rollback and contains no destructive statements", () => {
    expect(sql).toMatch(/rollback;\s*$/i);
    expect(sql).not.toMatch(/^\s*(drop|truncate|delete)\b/im);
  });

  it("does not assign ownership, activate RLS, or remove legacy policies", () => {
    expect(sql).not.toMatch(/update\s+public\.[a-z_]+\s+set\s+organization_id/i);
    expect(sql).not.toMatch(/enable\s+row\s+level\s+security/i);
    expect(sql).not.toMatch(/drop\s+policy/i);
  });

  it("preserves legacy objects and adds required schema", () => {
    ["seller_tasks","organizations","organization_memberships","communication_consents"].forEach((table) =>
      expect(sql).toContain(`create table if not exists public.${table}`));
    ["provider","provider_message_id","provider_status","provider_status_updated_at","error_code","consent_event"].forEach((column) =>
      expect(sql).toContain(`add column if not exists ${column}`));
    expect(sql).not.toMatch(/alter\s+table\s+public\."Deals"/);
    expect(sql).not.toMatch(/alter\s+table\s+public\.(activities|leads)/i);
  });

  it("guards incompatible, duplicate, foreign-key, and case-collision states", () => {
    ["preflight type mismatch","required legacy alias source column is missing","conflicting constraint definition","duplicate property address","invalid legacy deal reference","case-sensitive Deals collision"].forEach((guard) => expect(sql).toContain(guard));
  });

  it("does not falsify the migration ledger", () => {
    expect(sql).not.toMatch(/schema_migrations|insert\s+into\s+supabase_migrations/i);
    expect(assertions).toContain("migration ledger falsified");
  });

  it("models production-like synthetic counts and preservation assertions", () => {
    expect(fixture).toContain("generate_series(1,16)");
    expect(fixture).toContain("generate_series(1,7)");
    ["public.\"Deals\"","public.activities","public.leads"].forEach((object) => expect(fixture).toContain(object));
    ["synthetic deals changed","synthetic messages changed","legacy Deals changed","legacy activities changed","legacy leads changed"].forEach((check) => expect(assertions).toContain(check));
  });

  it("limits executable validation to explicitly authorized local disposable databases", () => {
    expect(() => assertSafeTarget("postgresql://u@example.com/eo_prod_02_a","true")).toThrow("only a local");
    expect(() => assertSafeTarget("postgresql://u@127.0.0.1/production","true")).toThrow("eo_prod_02_");
    expect(() => assertSafeTarget("postgresql://u@127.0.0.1/eo_prod_02_a","false")).toThrow("ALLOW_LOCAL_DB_TESTS");
  });

  it("has an explicit local-only commit transform for rerun validation", () => {
    const executable = committedCandidate();
    expect(executable).toMatch(/commit;\s*$/i);
    expect(executable).not.toMatch(/rollback;\s*$/i);
  });
});
