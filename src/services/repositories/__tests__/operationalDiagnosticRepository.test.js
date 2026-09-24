import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, insert } = vi.hoisted(() => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert }));
  return { from, insert };
});

vi.mock("../../../supabaseClient", () => ({ supabase: { from } }));
vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
}));

import { recordOperationalFailure } from "../operationalDiagnosticRepository";

describe("operationalDiagnosticRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ data: null, error: null });
  });

  it("persists only bounded safe support metadata in the active organization", async () => {
    const result = await recordOperationalFailure({
      operationType: "lead-import",
      errorClassification: "persistence-failed",
      correlationId: `safe-${"x".repeat(200)}`,
    });

    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith("operational_failure_diagnostics");
    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      operation_type: "lead-import",
      error_classification: "persistence-failed",
      correlation_id: expect.any(String),
      status: "open",
    });
    const payload = insert.mock.calls[0][0];
    expect(payload.correlation_id.length).toBe(120);
    expect(payload).not.toHaveProperty("error");
    expect(payload).not.toHaveProperty("message");
    expect(payload).not.toHaveProperty("payload");
  });
});
