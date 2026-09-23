import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const lifecycleFiles = [
  "src/services/repositories/offerLifecycleRepository.js",
  "src/services/repositories/closingLifecycleRepository.js",
  "src/services/offers/offerLifecycleService.js",
  "src/services/transactions/closingLifecycleService.js",
  "src/components/OfferLifecyclePanel.jsx",
  "src/components/ClosingLifecyclePanel.jsx",
].map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");

describe("offer-to-close safety boundary", () => {
  it("contains no provider, AI, communication, signing, or payment execution", () => {
    expect(lifecycleFiles).not.toMatch(/\bfetch\s*\(|\.functions\.invoke|sendSms|sendEmail|twilio|openai|stripe|e-sign|docusign/i);
    expect(lifecycleFiles).not.toMatch(/message_logs|communication_consents/);
  });

  it("does not restore mutable deal fields as an application write authority", () => {
    expect(lifecycleFiles).not.toMatch(/updateDeal|updateOwnedDeal|\.from\(["']deals["']\)/);
  });
});
