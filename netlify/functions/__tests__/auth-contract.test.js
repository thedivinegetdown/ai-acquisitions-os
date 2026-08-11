import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const repositoryRoot = process.cwd();

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function source(path) {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

describe("service-role and tenant-scope static contracts", () => {
  it("keeps the service-role environment variable out of frontend source", () => {
    const matches = filesUnder(join(repositoryRoot, "src"))
      .filter((path) => !path.includes("__tests__"))
      .filter((path) =>
        readFileSync(path, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY")
      );

    expect(matches.map((path) => relative(repositoryRoot, path))).toEqual([]);
  });

  it("limits service-role configuration references to reviewed server boundaries", () => {
    const matches = filesUnder(join(repositoryRoot, "netlify", "functions"))
      .filter((path) => !path.includes("__tests__"))
      .filter((path) =>
        readFileSync(path, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY")
      )
      .map((path) => relative(repositoryRoot, path).replaceAll("\\", "/"))
      .sort();

    expect(matches).toEqual([
      "netlify/functions/_shared/auth.cjs",
      "netlify/functions/health-check.js",
      "netlify/functions/inbound-v2.cjs",
    ]);
  });

  it("pins admin membership and deal lookups to authenticated tenant context", () => {
    const authSource = source("netlify/functions/_shared/auth.cjs");

    expect(authSource).toContain('.eq("user_id", authenticated.auth.userId)');
    expect(authSource).toContain('.eq("organization_id", requested.organizationId)');
    expect(authSource).toContain('.eq("organization_id", organizationId)');
    expect(authSource).toContain('.eq("organization.status", "active")');
  });

  it("persists outbound message logs with server-resolved organization scope", () => {
    const smsSource = source("netlify/functions/send-sms.cjs");

    expect(smsSource).toContain("organization_id: organizationId");
    expect(smsSource).toContain("organization_id: logData.organization_id");
    expect(smsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not enable wildcard CORS on authenticated business responses", () => {
    const securitySource = source("netlify/functions/_shared/security.cjs");

    expect(securitySource).not.toContain('"Access-Control-Allow-Origin": "*"');
    expect(securitySource).toContain("X-Organization-Id");
  });
});
