import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSupportingEvidenceAppendMutation,
} from "../supportingEvidenceService";
import {
  saveResearchCommand,
  saveSupportingEvidenceCommand,
} from "../../repositories/researchRepository";

const state = vi.hoisted(() => ({
  context: { organizationId: "org-1", userId: "operator-1" },
  row: null,
  writes: [],
}));

vi.mock("../../../supabaseClient", () => ({
  supabase: {
    from: (table) => {
      const filters = [];
      let payload;
      const query = {
        update: (value) => {
          payload = value;
          state.writes.push({ table, payload });
          return query;
        },
        eq: (field, value) => {
          filters.push([field, value]);
          return query;
        },
        is: (field, value) => {
          filters.push([field, value]);
          return query;
        },
        select: () => query,
        limit: async () => {
          if (!state.row || !filters.every(([field, value]) => (state.row[field] ?? null) === value)) {
            return { data: [] };
          }
          state.row = structuredClone({ ...state.row, ...payload });
          return { data: [structuredClone(state.row)] };
        },
      };
      return query;
    },
  },
}));

vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: async () => state.context,
}));

const baseDeal = {
  id: "deal-1",
  organization_id: "org-1",
  tenant_id: "tenant-1",
  updated_at: "2026-10-02T12:00:00.000Z",
  research_revision: 0,
  research_evidence: [{ evidenceId: "existing-evidence", valueSummary: "Existing fact" }],
  owner_name: "Ben Aviv",
  asset_type: "residential-home",
  arv: 250000,
  asking_price: 100000,
  stage: "due-diligence",
  recommendation: "RESEARCH",
  offer_status: null,
  closing_status: null,
};

const ownershipCommand = {
  category: "ownership_title",
  fact: "Record owner is Ben Aviv.",
  sourceName: "Orange County Comptroller",
  sourceUrl: "https://example.gov/records/123",
  sourceReference: "Instrument 2024012345 / OR 12345 PG 678",
  sourceDate: "2024-07-17T12:00:00.000Z",
  retrievedAt: "2026-10-02T13:45:00.000Z",
  status: "VERIFIED",
  resolutionState: "SUPPORTING",
  parcelIdentifier: "27-22-27-8894-01-140",
  ownerPartyName: "Ben Aviv",
  notes: "Record linkage is exact by parcel and grantee.",
};

beforeEach(() => {
  state.context = { organizationId: "org-1", userId: "operator-1" };
  state.row = structuredClone(baseDeal);
  state.writes = [];
});

describe("supporting deal evidence intake", () => {
  it("appends complete VERIFIED ownership evidence and changes no canonical or decision fields", async () => {
    const result = await saveSupportingEvidenceCommand(state.row, ownershipCommand);

    expect(result.success).toBe(true);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].table).toBe("deals");
    expect(Object.keys(state.writes[0].payload).sort()).toEqual(["research_evidence", "research_revision"]);
    expect(state.row.research_evidence).toHaveLength(2);
    expect(state.row.research_evidence[0]).toEqual(baseDeal.research_evidence[0]);
    expect(state.row.research_evidence[1]).toMatchObject({
      organizationId: "org-1",
      tenantId: "tenant-1",
      relationship: "supports",
      supportingEvidence: {
        category: "ownership_title",
        fact: ownershipCommand.fact,
        source: {
          name: ownershipCommand.sourceName,
          url: ownershipCommand.sourceUrl,
          reference: ownershipCommand.sourceReference,
          sourceDate: ownershipCommand.sourceDate,
          retrievedAt: ownershipCommand.retrievedAt,
        },
        status: "VERIFIED",
        linkage: {
          parcelIdentifier: ownershipCommand.parcelIdentifier,
          ownerPartyName: ownershipCommand.ownerPartyName,
        },
        resolutionState: "SUPPORTING",
        notes: ownershipCommand.notes,
      },
    });
    expect(state.row).toMatchObject({
      owner_name: baseDeal.owner_name,
      asset_type: baseDeal.asset_type,
      arv: baseDeal.arv,
      asking_price: baseDeal.asking_price,
      stage: baseDeal.stage,
      recommendation: baseDeal.recommendation,
      offer_status: baseDeal.offer_status,
      closing_status: baseDeal.closing_status,
    });
  });

  it("preserves INDICATIVE, UNKNOWN/UNRESOLVED, and CONFLICTING records side by side", () => {
    const first = buildSupportingEvidenceAppendMutation({
      deal: baseDeal,
      actorReference: "operator-1",
      command: {
        ...ownershipCommand,
        category: "occupancy",
        fact: "Returned-mail indicator suggests possession risk.",
        status: "INDICATIVE",
      },
    });
    const second = buildSupportingEvidenceAppendMutation({
      deal: { ...baseDeal, ...first },
      actorReference: "operator-1",
      command: {
        ...ownershipCommand,
        category: "bankruptcy_probate",
        fact: "Bankruptcy and probate status not verified.",
        status: "UNKNOWN",
        resolutionState: "UNRESOLVED",
      },
    });
    const third = buildSupportingEvidenceAppendMutation({
      deal: { ...baseDeal, ...second },
      actorReference: "operator-1",
      command: {
        ...ownershipCommand,
        category: "mortgage_liens",
        fact: "A recorded item conflicts with the earlier negative name search.",
        resolutionState: "CONFLICTING",
      },
    });

    expect(third.research_evidence).toHaveLength(4);
    expect(third.research_evidence.slice(1).map((entry) => [
      entry.supportingEvidence.category,
      entry.supportingEvidence.status,
      entry.supportingEvidence.resolutionState,
    ])).toEqual([
      ["occupancy", "INDICATIVE", "SUPPORTING"],
      ["bankruptcy_probate", "UNKNOWN", "UNRESOLVED"],
      ["mortgage_liens", "VERIFIED", "CONFLICTING"],
    ]);
  });

  it.each([
    ["category", { category: "seller_identity" }],
    ["status", { status: "UNVERIFIED" }],
    ["resolution state", { resolutionState: "RESOLVED" }],
  ])("rejects an unsupported %s", (_label, override) => {
    expect(() => buildSupportingEvidenceAppendMutation({
      deal: baseDeal,
      actorReference: "operator-1",
      command: { ...ownershipCommand, ...override },
    })).toThrow(/supported/);
  });

  it("fails closed for cross-tenant and stale writes", async () => {
    state.context = { organizationId: "org-2", userId: "operator-2" };
    const crossTenant = await saveSupportingEvidenceCommand(state.row, ownershipCommand);
    expect(crossTenant.success).toBe(false);
    expect(state.writes).toHaveLength(0);

    state.context = { organizationId: "org-1", userId: "operator-1" };
    const stale = { ...state.row, research_revision: state.row.research_revision + 1 };
    const staleResult = await saveSupportingEvidenceCommand(stale, ownershipCommand);
    expect(staleResult.success).toBe(false);
    expect(state.row.research_evidence).toEqual(baseDeal.research_evidence);
  });

  it("keeps the existing canonical Resolve Research path operational and separate", async () => {
    state.row = { ...state.row, arv: null };
    const result = await saveResearchCommand(state.row, {
      type: "record",
      field: "property.afterRepairValue",
      value: "275000",
      source: "Qualified appraisal 42",
      sourceType: "property-record",
      verificationState: "verified",
      sourceTimestamp: "2026-10-01T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
    expect(state.row.arv).toBe(275000);
    expect(state.row.research_evidence.some((entry) => entry.relatedCanonicalField === "property.afterRepairValue")).toBe(true);
    expect(state.row.research_evidence.some((entry) => entry.supportingEvidence)).toBe(false);
  });
});
