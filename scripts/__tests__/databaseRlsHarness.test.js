import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { assertSafeTarget, listMigrations } = require("../test-local-database-rls.cjs");
const root = process.cwd();

describe("EO-VAL-01 guarded database harness", () => {
  it("requires explicit local-test authorization", () => {
    expect(() =>
      assertSafeTarget("postgresql://postgres:test@127.0.0.1/eo_val_a", "false")
    ).toThrow("ALLOW_LOCAL_DB_TESTS=true");
  });

  it.each([
    "postgresql://postgres:test@db.example.com/eo_val_a",
    "postgresql://postgres:test@project.supabase.co/eo_val_a",
  ])("rejects non-local database target %s", (url) => {
    expect(() => assertSafeTarget(url, "true")).toThrow("non-local");
  });

  it.each([
    "postgresql://postgres:test@127.0.0.1/postgres",
    "postgresql://postgres:test@localhost/production",
  ])("rejects database names outside the eo_val_ namespace", (url) => {
    expect(() => assertSafeTarget(url, "true")).toThrow("start with eo_val_");
  });

  it("accepts an explicitly authorized local test database", () => {
    expect(
      assertSafeTarget(
        "postgresql://postgres:test@127.0.0.1:5432/eo_val_a",
        "true"
      )
    ).toMatchObject({ database: "eo_val_a" });
  });

  it("discovers all committed migrations in deterministic order", () => {
    const migrations = listMigrations().map((file) => path.basename(file));
    expect(migrations).toEqual([
      "202606240001_create_current_schema_baseline.sql",
      "202606250001_create_seller_tasks.sql",
      "202606270001_add_message_logs_direction.sql",
      "202606280001_complete_current_schema_constraints.sql",
      "202608110001_create_tenant_security_foundation.sql",
      "202608110002_define_tenant_rls_policies.sql",
      "202608110003_enforce_tenant_ownership_immutability.sql",
      "202608110004_harden_twilio_communications.sql",
      "202608130001_allow_initial_tenant_ownership_assignment.sql",
      "202609230001_add_durable_lead_intake_idempotency.sql",
      "202609230002_add_deal_research_resolution.sql",
      "202609230003_add_offer_to_close_lifecycle.sql",
      "202609240001_add_decision_memory.sql",
      "202609240002_add_assisted_pilot_readiness.sql",
      "202609240003_restrict_pilot_admin_function_execution.sql",
      "202609240004_add_scale_safety_diagnostics.sql",
      "202609240005_add_rentcast_property_evidence.sql",
      "202610090001_add_deal_operating_scope.sql",
      "202610150001_add_canonical_property_identity.sql",
      "202610250001_enforce_research_only_communication_safety.sql",
    ]);
    expect(new Set(migrations).size).toBe(migrations.length);
    migrations.forEach((migration) =>
      expect(migration).toMatch(/^\d{12}_[a-z0-9_]+\.sql$/)
    );
  });

  it("pins the already-applied communication migration without executing SQL", () => {
    const migration = readFileSync(path.join(
      root, "supabase", "migrations",
      "202610250001_enforce_research_only_communication_safety.sql"
    ), "utf8");
    // Git checkouts may use CRLF; compare the exact accepted LF source bytes.
    expect(createHash("sha256").update(migration.replace(/\r\n/g, "\n")).digest("hex"))
      .toBe("1c969dc96daf384cf531897298a2b51f69ccecb42c7e02fa52a026197117cfd4");
  });

  it("keeps the one-time ownership bootstrap correction in migration history", () => {
    const migrations = listMigrations().map((file) => path.basename(file));
    const correctionMigration = "202608130001_allow_initial_tenant_ownership_assignment.sql";
    expect(migrations).toContain(correctionMigration);

    const correction = readFileSync(
      path.join(root, "supabase", "migrations", correctionMigration),
      "utf8"
    ).toLowerCase();
    expect(correction).toContain("old.organization_id is not null");
    expect(correction).toContain(
      "new.organization_id is distinct from old.organization_id"
    );
    expect(correction).not.toMatch(/disable trigger|drop trigger|session_replication_role/);
  });

  it("keeps executable coverage for the required RLS boundaries", () => {
    const runner = readFileSync(
      path.join(root, "scripts", "test-local-database-rls.cjs"),
      "utf8"
    );
    const rls = readFileSync(
      path.join(root, "supabase", "tests", "eo_val_01_rls.sql"),
      "utf8"
    );

    [
      "Missing ownership activation",
      "One-time synthetic ownership assignment",
      "Established ownership transfer denial",
      "Established ownership clearing denial",
      "Orphan organization activation",
      "Ownerless organization activation",
      "Cross-tenant child activation",
      "Missing policy activation",
      "Clean RLS activation",
      "two clean local databases",
    ].forEach((contract) => expect(runner).toContain(contract));

    [
      "owner A cannot insert for organization B",
      "analyst cannot create membership",
      "viewer insert denied",
      "anonymous writes denied",
      "cross-tenant message deal rejected",
      "cross-tenant consent insert denied",
      "only service_role has bypassrls",
      "service role normal update cannot transfer ownership",
    ].forEach((contract) => expect(rls).toContain(contract));
  });
});
