import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/202609240005_add_rentcast_property_evidence.sql", "utf8").toLowerCase();
const frontend = [
  "src/services/propertyData/rentCastPropertyDataProvider.js",
  "src/workspaces/deals/RentCastPropertyEvidencePanel.jsx",
].map((file) => readFileSync(file, "utf8")).join("\n");

describe("RentCast additive schema and secret boundary", () => {
  it("adds tenant-scoped normalized evidence with immediate RLS and composite deal ownership", () => {
    expect(sql).toContain("create table if not exists public.property_provider_evidence");
    expect(sql).toContain("foreign key (deal_id, organization_id)");
    expect(sql).toContain("references public.deals (id, organization_id) on delete restrict");
    expect(sql).toContain("alter table public.property_provider_evidence enable row level security");
    expect(sql).toContain("property_provider_evidence_select_member");
    expect(sql).toContain("unique (organization_id, deal_id, provider)");
    expect(sql).not.toMatch(/create table[^;]*raw_payload/is);
  });

  it("defaults RentCast off and performs atomic grouped usage accounting", () => {
    expect(sql).toContain("select id, 'rentcast', false from public.organizations");
    expect(sql).toContain("consume_organization_provider_requests");
    expect(sql).toMatch(/request_count \+ p_request_count\s+<= policy\.monthly_request_cap/);
    expect(sql).toContain("to service_role");
  });

  it("keeps the RentCast key out of browser source", () => {
    expect(frontend).not.toContain("RENTCAST_API_KEY");
    expect(frontend).not.toContain("X-Api-Key");
    expect(frontend).not.toContain("api.rentcast.io");
  });
});
