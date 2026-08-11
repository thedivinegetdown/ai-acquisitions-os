import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const inbound = read("netlify/functions/inbound-v2.cjs");
const outbound = read("netlify/functions/send-sms.cjs");
const status = read("netlify/functions/twilio-status.cjs");
const helper = read("netlify/functions/_shared/twilio.cjs");
const security = read("netlify/functions/_shared/security.cjs");
const migration = read(
  "supabase/migrations/202608110004_harden_twilio_communications.sql"
).toLowerCase();

describe("Twilio communications static security contracts", () => {
  it("requires provider signatures for both external Twilio endpoints", () => {
    expect(inbound).toContain("validateTwilioWebhook");
    expect(status).toContain("validateTwilioWebhook");
    expect(inbound).not.toContain("requireTenantContext");
    expect(status).not.toContain("requireTenantContext");
  });

  it("keeps outbound SMS behind EO-SEC-02 and tenant consent", () => {
    expect(outbound).toContain("requireTenantContext");
    expect(outbound).toContain('.from("communication_consents")');
    expect(outbound).toContain('.eq("organization_id", organizationId)');
    expect(outbound).toContain('consent.status === "opted-out"');
  });

  it("uses configured canonical routing instead of proxy or request tenant input", () => {
    expect(helper).toContain("PUBLIC_SITE_URL");
    expect(helper).not.toContain("x-forwarded-host");
    expect(helper).not.toContain("x-forwarded-proto");
    expect(helper).toContain("TWILIO_ORGANIZATION_ID");
    expect(inbound).not.toMatch(/params\.(organization_id|OrganizationId)/);
  });

  it("enforces provider identity uniqueness and tenant-scoped status updates", () => {
    expect(migration).toContain("message_logs_provider_message_id_uidx");
    expect(migration).toContain("unique index");
    expect(status).toContain('.eq("organization_id", route.organizationId)');
    expect(status).toContain('.eq("provider_message_id", providerMessageId)');
    expect(status).not.toContain('.insert(');
  });

  it("keeps secrets server-only and authenticated CORS non-wildcard", () => {
    expect(helper).toContain("TWILIO_AUTH_TOKEN");
    expect(read("src/services/sms/smsService.js")).not.toContain(
      "TWILIO_AUTH_TOKEN"
    );
    expect(security).not.toContain('"Access-Control-Allow-Origin": "*"');
  });
});
