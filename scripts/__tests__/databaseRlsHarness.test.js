import { createRequire } from "node:module";
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
    expect(migrations).toHaveLength(12);
    expect(migrations).toEqual([...migrations].sort());
    migrations.forEach((migration) =>
      expect(migration).toMatch(/^\d{12}_[a-z0-9_]+\.sql$/)
    );
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
