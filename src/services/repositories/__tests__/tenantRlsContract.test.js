import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrations = readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(path.join(root, "supabase", "migrations", name), "utf8"))
  .join("\n")
  .toLowerCase();
const activation = readFileSync(
  path.join(root, "supabase", "security", "activate_rls.sql"),
  "utf8"
).toLowerCase();
const rollout = readFileSync(
  path.join(root, "docs", "security", "TENANT_RLS_ROLLOUT.md"),
  "utf8"
).toLowerCase();

function readSourceTree(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name === "__tests__") return [];
    if (entry.isDirectory()) return readSourceTree(target);
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name)
      ? [readFileSync(target, "utf8")]
      : [];
  });
}

const frontendSource = readSourceTree(path.join(root, "src")).join("\n");

const tenantTables = [
  "deals",
  "message_logs",
  "seller_tasks",
  "buyers",
  "documents",
  "comps",
  "sequences",
];
const dealChildren = ["message_logs", "seller_tasks", "documents", "comps", "sequences"];

describe("tenant and RLS migration contract", () => {
  it("defines organizations and constrained membership roles", () => {
    expect(migrations).toContain("create table if not exists public.organizations");
    expect(migrations).toContain("create table if not exists public.organization_memberships");
    expect(migrations).toContain("unique (organization_id, user_id)");
    expect(migrations).toContain("role in ('owner', 'admin', 'analyst', 'viewer')");
    expect(migrations).toContain("status in ('active', 'suspended', 'revoked')");
    expect(migrations).toContain("on delete restrict");
  });

  it("adds nullable ownership, foreign keys, and query indexes to every business table", () => {
    tenantTables.forEach((table) => {
      expect(migrations).toContain(
        `alter table public.${table} add column if not exists organization_id uuid`
      );
      expect(migrations).toContain(`${table}_organization_id_fkey`);
      expect(migrations).toContain(`${table}_organization_created_at_idx`);
    });
    tenantTables.forEach((table) => {
      expect(migrations).not.toMatch(
        new RegExp(`alter table public\\.${table} add column if not exists organization_id uuid not null`)
      );
    });
  });

  it("enforces same-organization deal relationships after ownership assignment", () => {
    expect(migrations).toContain("deals_id_organization_id_key");
    dealChildren.forEach((table) => {
      expect(migrations).toContain(`${table}_deal_organization_fkey`);
      expect(migrations).toContain("foreign key (deal_id, organization_id)");
    });
  });

  it("allows one-time legacy assignment but prevents later tenant transfers", () => {
    expect(migrations).toContain("old.organization_id is not null");
    expect(migrations).toContain(
      "new.organization_id is distinct from old.organization_id"
    );
    [...tenantTables, "organization_memberships"].forEach((table) => {
      expect(migrations).toContain(`${table}_prevent_organization_transfer`);
    });
  });

  it("uses fixed-search-path helpers tied to auth.uid without dynamic SQL", () => {
    [
      "is_organization_member",
      "has_organization_role",
      "create_personal_organization",
    ].forEach((name) => expect(migrations).toContain(`function public.${name}`));
    expect(migrations).toContain("security definer");
    expect(migrations).toContain("set search_path = pg_catalog, public");
    expect(migrations).toContain("auth.uid()");
    expect(migrations).not.toMatch(/\bexecute\s+format\b/);
  });

  it("bootstraps an authenticated caller as owner and rejects duplicate active bootstrap", () => {
    expect(migrations).toMatch(
      /create_personal_organization\(organization_name text\)[\s\S]*role,\s*status\s*\)[\s\S]*'owner',\s*'active'/
    );
    expect(migrations).toContain("active organization membership already exists");
    expect(migrations).toContain("pg_advisory_xact_lock");
    expect(migrations).not.toMatch(/create_personal_organization\([^)]*user_id/);
  });

  it("defines membership-based read and bounded write policies without delete access", () => {
    ["organizations", "organization_memberships", ...tenantTables].forEach((table) => {
      expect(migrations).toContain(`create policy ${table}_select_member`);
    });
    tenantTables.forEach((table) => {
      expect(migrations).toContain(`create policy ${table}_insert_writer`);
      expect(migrations).toContain(`create policy ${table}_update_writer`);
      expect(migrations).toMatch(
        new RegExp(
          `create policy ${table}_select_member[\\s\\S]*?using \\(public\\.is_organization_member\\(organization_id\\)\\)`
        )
      );
      expect(migrations).toMatch(
        new RegExp(
          `create policy ${table}_update_writer[\\s\\S]*?using \\([\\s\\S]*?with check \\(`
        )
      );
    });
    expect(migrations).toContain("array['owner', 'admin', 'analyst']");
    expect(migrations).not.toContain("array['owner', 'admin', 'analyst', 'viewer']");
    expect(migrations).not.toMatch(/create policy [_a-z]+_delete/);
    expect(migrations).not.toMatch(/organization_memberships_(insert|update)_analyst/);
    expect(migrations).toContain("to authenticated");
    expect(migrations).toContain("membership.user_id = auth.uid()");
    expect(migrations).toContain("membership.status = 'active'");
    expect(migrations).not.toMatch(/using \([^)]*organization_id is null/);
  });

  it("defines tenant-safe communication consent without activating RLS", () => {
    expect(migrations).toContain(
      "create table if not exists public.communication_consents"
    );
    expect(migrations).toContain(
      "unique (organization_id, normalized_phone, channel)"
    );
    expect(migrations).toContain(
      "communication_consents_prevent_organization_transfer"
    );
    ["select_member", "insert_writer", "update_writer"].forEach((policy) => {
      expect(migrations).toContain(
        "create policy communication_consents_" + policy
      );
    });
    expect(activation).toContain(
      "alter table public.communication_consents enable row level security"
    );
  });

  it("provides fail-closed readiness checks for every activation blocker", () => {
    expect(migrations).toContain("tenant_table_ownership_report");
    expect(migrations).toContain("row_count bigint");
    expect(migrations).toContain("null_organization_count bigint");

    [
      "null_organization_id",
      "orphan_organization_id",
      "cross_tenant_deal",
      "active_organization_without_owner",
      "assert_tenant_rls_ready",
    ].forEach((check) => expect(migrations).toContain(check));
    tenantTables.forEach((table) => expect(migrations).toContain(`'${table}'`));
  });

  it("keeps activation outside migrations and verifies readiness first", () => {
    expect(migrations).not.toMatch(/enable row level security|force row level security/);
    expect(activation).toContain("select public.assert_tenant_rls_ready()");
    expect(activation.indexOf("assert_tenant_rls_ready")).toBeLessThan(
      activation.indexOf("enable row level security")
    );
    ["organizations", "organization_memberships", ...tenantTables].forEach((table) => {
      expect(activation).toContain(`alter table public.${table} enable row level security`);
    });
    expect(activation).toContain("pg_policies");
    expect(activation).toContain("relrowsecurity");
  });

  it("documents the service-role bypass and staged manual rollout", () => {
    expect(rollout).toContain("policy presence is not enforcement");
    expect(rollout).toContain("service role");
    expect(rollout).toContain("bypasses rls");
    expect(rollout).toContain("activation blocker");
    expect(rollout).toContain("manually authorized");
  });

  it("introduces no destructive schema operation or obvious credential literal", () => {
    expect(migrations).not.toMatch(/\bdrop\s+(table|column|schema)\b|\btruncate\b|on delete cascade/);
    expect(migrations).not.toMatch(/eyj[a-z0-9_-]{20,}|sk_live_[a-z0-9]+|service_role\s*=\s*['"][^'"]+/i);
    expect(activation).not.toMatch(/eyj[a-z0-9_-]{20,}|sk_live_[a-z0-9]+/i);
  });


  it("keeps the service-role environment variable out of frontend source", () => {
    expect(frontendSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
