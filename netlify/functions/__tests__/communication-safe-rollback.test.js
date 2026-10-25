import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const { prepareRollback } = require("../../../scripts/prepare-communication-safe-rollback.cjs");
const originalEnv = { ...process.env };
let packet;
let sms;
let email;

beforeAll(() => {
  packet = prepareRollback();
  expect(createHash("sha256").update(readFileSync(packet.archive)).digest("hex"))
    .toBe(packet.archiveSha256);
  const extracted = path.join(path.dirname(packet.source), "extracted-proof");
  mkdirSync(extracted);
  execFileSync("tar", ["-xf", packet.archive, "-C", extracted]);
  for (const file of packet.files) {
    expect(createHash("sha256").update(readFileSync(path.join(extracted, file.file))).digest("hex"))
      .toBe(file.sha256);
  }
  sms = require(path.join(extracted, "netlify/functions/send-sms.cjs"));
  email = require(path.join(extracted, "netlify/functions/send-email.js"));
  console.info("ROLLBACK_ARTIFACT", JSON.stringify({
    sourceRevision: packet.sourceRevision, archive: packet.archive,
    archiveSha256: packet.archiveSha256, manifestPath: packet.manifestPath,
    manifestSha256: packet.manifestSha256, filesVerified: packet.files.length,
  }));
}, 30000);

afterEach(() => {
  Object.keys(process.env).forEach((key) => delete process.env[key]);
  Object.assign(process.env, originalEnv);
  vi.restoreAllMocks();
});

function fixture({ scope = "research_only", organizationId = "org-a", consent = "opted-in" } = {}) {
  const storedDeal = { id: "deal-a", organization_id: organizationId, operating_scope: scope };
  const insert = vi.fn().mockResolvedValue({ error: null });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn().mockImplementation(async () => ({
      data: organizationId === "org-a" ? [storedDeal] : [], error: null,
    })),
  };
  const adminClient = { from: vi.fn((table) => table === "deals" ? query : { insert }) };
  const authorize = vi.fn().mockResolvedValue({
    context: { organizationId: "org-a", userId: "user-a", role: "owner" },
    clients: { adminClient },
  });
  const create = vi.fn().mockResolvedValue({ sid: "SM_SYNTHETIC_ONLY", status: "queued" });
  const twilioFactory = vi.fn(() => ({ messages: { create } }));
  const loadConsent = vi.fn().mockResolvedValue({ status: consent });
  // These are fixture placeholders only, with a mocked provider factory. The
  // test reaches the live-send branch without ever loading real credentials.
  Object.assign(process.env, {
    SMS_TEST_MODE: "false", TWILIO_ACCOUNT_SID: "synthetic-account",
    TWILIO_AUTH_TOKEN: "synthetic-token", TWILIO_PHONE_NUMBER: "+15550000001",
    TWILIO_ORGANIZATION_ID: "org-a", PUBLIC_SITE_URL: "https://rollback.example.test",
  });
  const handler = sms.createSendSmsHandler({ authorize, loadConsent, twilioFactory });
  return { query, insert, create, twilioFactory, loadConsent, authorize, handler };
}

const request = (overrides = {}) => ({
  httpMethod: "POST", headers: {},
  body: JSON.stringify({
    deal_id: "deal-a", to: "+15550000002", message: "Synthetic only",
    // An old or direct client must not be able to override stored scope.
    operating_scope: "active_acquisition", ...overrides,
  }),
});

describe("complete communication-safe rollback artifact", () => {
  it("retains the exact old application plus the five qualified safety files", () => {
    expect(packet.retainedFiles).toHaveLength(5);
    expect(packet.applicationBase).toBe("aa9726488a312db18a84d63ce3cfe82ab63499cf");
    expect(packet.files.length).toBeGreaterThan(100);
    expect(packet.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(path.join(packet.source, "netlify.toml"), "utf8"))
      .toContain('directory = "netlify/functions"');
  });

  it("blocks research-only SMS at the actual send boundary despite live configuration", async () => {
    const f = fixture();
    const response = await f.handler(request());
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).status).toBe("blocked-by-operating-scope");
    expect(f.query.eq).toHaveBeenCalledWith("organization_id", "org-a");
    expect(f.query.select).toHaveBeenCalledWith("id, organization_id, operating_scope");
    expect(f.twilioFactory).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.loadConsent).not.toHaveBeenCalled();
  });

  it("blocks research-only email before provider foundation behavior", async () => {
    const f = fixture();
    const handler = email.createSendEmailHandler({ authorize: f.authorize });
    const response = await handler(request({ to: "synthetic@example.test", subject: "Fixture", body: "Fixture" }));
    expect(response.statusCode).toBe(403);
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.twilioFactory).not.toHaveBeenCalled();
  });

  it("allows active acquisition at the mocked provider boundary and records its source deal", async () => {
    const f = fixture({ scope: "active_acquisition" });
    const response = await f.handler(request());
    expect(response.statusCode).toBe(200);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({
      deal_id: "deal-a", organization_id: "org-a", direction: "outbound",
    }));
  });

  it("preserves consent denial for active acquisition", async () => {
    const f = fixture({ scope: "active_acquisition", consent: "opted-out" });
    expect((await f.handler(request())).statusCode).toBe(403);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
  });

  it("denies cross-tenant and missing-deal requests before provider access", async () => {
    const f = fixture({ scope: "active_acquisition", organizationId: "org-b" });
    expect((await f.handler(request())).statusCode).toBe(404);
    expect((await f.handler(request({ deal_id: null }))).statusCode).toBe(400);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
  });
});
