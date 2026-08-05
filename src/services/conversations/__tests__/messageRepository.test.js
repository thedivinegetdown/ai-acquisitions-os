import { describe, expect, it } from "vitest";

import { normalizeMessageRecord } from "../messageRepository";

describe("messageRepository", () => {
  it("preserves explicit inbound and outbound directions", () => {
    expect(normalizeMessageRecord({ direction: "outbound" }).direction).toBe(
      "outbound"
    );
    expect(normalizeMessageRecord({ direction: "inbound" }).direction).toBe(
      "inbound"
    );
  });

  it("derives outbound direction from legacy outbound statuses", () => {
    expect(normalizeMessageRecord({ status: "sent" })).toMatchObject({
      direction: "outbound",
      directionSource: "legacy-status",
      statusWasExplicit: true,
    });
    expect(normalizeMessageRecord({ status: "test" }).direction).toBe(
      "outbound"
    );
  });

  it("defaults legacy rows without outbound signals to inbound", () => {
    expect(normalizeMessageRecord({ status: "received" }).direction).toBe(
      "inbound"
    );
    expect(normalizeMessageRecord({})).toMatchObject({
      direction: "inbound",
      directionSource: "legacy-default",
      statusWasExplicit: false,
    });
  });
});
