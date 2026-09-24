import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8").toLowerCase();
const original = read("supabase/migrations/202609240002_add_assisted_pilot_readiness.sql");
const correction = read("supabase/migrations/202609240003_restrict_pilot_admin_function_execution.sql");
const contract = read("supabase/tests/build6_admin_acl.sql");
const signatures = [
  "provision_assisted_pilot(text, text, uuid, text)",
  "set_assisted_pilot_status(uuid, text)",
  "configure_assisted_pilot_settings(uuid, jsonb)",
  "configure_assisted_pilot_provider(uuid, text, boolean, integer, integer)",
  "consume_organization_provider_request(uuid, text, integer)",
  "persist_assisted_pilot_import(uuid, text, jsonb)",
  "export_assisted_pilot_data(uuid)",
  "pilot_support_diagnostics(uuid)",
];

describe("Build 6 exact admin RPC ACL correction", () => {
  it("covers exactly the eight introduced SECURITY DEFINER functions", () => {
    const names = [...original.matchAll(/create or replace function public\.(\w+)\(/g)].map((match) => match[1]);
    expect(names).toEqual(signatures.map((signature) => signature.split("(")[0]));
    expect(original.match(/security definer/g)).toHaveLength(8);
  });

  it.each(signatures)("explicitly revokes PUBLIC and both API roles for %s", (signature) => {
    expect(correction).toContain(`revoke execute on function public.${signature} from public, anon, authenticated;`);
    expect(correction).toContain(`grant execute on function public.${signature} to service_role;`);
    expect(contract).toContain(`'public.${signature.replaceAll(" ", "")}'`);
  });

  it("changes only the sixteen exact grants/revokes, not bodies, RLS, data, or defaults", () => {
    const statements = correction.replace(/--[^\n]*/g, "").split(";").map((sql) => sql.trim()).filter(Boolean);
    expect(statements).toHaveLength(16);
    expect(new Set(statements).size).toBe(16);
    statements.forEach((sql) => expect(sql).toMatch(/^(revoke|grant) execute on function public\./));
    expect(correction).not.toMatch(/alter default privileges|on all functions|create or replace|alter table/);
  });

  it("checks explicit PUBLIC ACL, effective API privileges, definer intent, and real owner permission denial", () => {
    ["routine.prosecdef", "acldefault('f', routine.proowner)", "grantee = 0", "privilege_type = 'execute'",
      "has_function_privilege('anon'", "has_function_privilege('authenticated'", "has_function_privilege('service_role'",
      "set local role authenticated", "role='owner'", "exception when insufficient_privilege", "begin read only",
    ].forEach((assertion) => expect(contract).toContain(assertion));
    expect(contract).not.toContain("when others");
  });
});
