import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildResearchMutation, assembleResearchContext } from "../researchResolutionService";
import { assembleDecisionRoomInputs } from "../../decision-intelligence/decisionRoomInputService";
import { buildCompatibilityDecisionReadModel } from "../../decision-intelligence/compatibilityDecisionService";
import { saveResearchCommand } from "../../repositories/researchRepository";
import { refreshCanonicalRecommendation } from "../../decision-intelligence/recalculationService";

const db = vi.hoisted(() => ({ row: null, writes: [], reads: [], filters: [] }));
vi.mock("../../../supabaseClient", () => ({ supabase: { from: (table) => {
  const filters = [];
  let payload;
  const query = {
    update: (value) => { payload = value; db.writes.push({ table, payload }); return query; },
    eq: (key, value) => { filters.push([key, value]); return query; },
    is: (key, value) => { filters.push([key, value]); return query; },
    select: () => query,
    limit: async () => {
      db.filters = filters;
      if (!filters.every(([key, value]) => (db.row[key] ?? null) === value)) return { data: [] };
      db.row = JSON.parse(JSON.stringify({ ...db.row, ...payload }));
      return { data: [JSON.parse(JSON.stringify(db.row))] };
    },
  };
  return query;
} } }));
vi.mock("../../organizations", () => ({ requireActiveOrganizationContext: async () => ({ organizationId: "org-1", userId: "operator-1" }) }));

const now = "2026-09-23T16:00:00.000Z";
const residential = { id: "deal-1", organization_id: "org-1", asset_type: "residential-home", property_address: "123 Main St", owner_name: "Seller", phone: "5551112222", price: 120000, research_revision: 0 };
const record = { type: "record", field: "property.afterRepairValue", value: "240000", source: "County appraisal 123", sourceType: "property-record", verificationState: "verified", sourceTimestamp: "2026-09-22T12:00:00.000Z" };
function mutate(deal, command) { return { ...deal, ...buildResearchMutation({ deal, command, actorReference: "operator-1", now }) }; }
function evaluate(deal, previous, extras = {}) {
  const result = buildCompatibilityDecisionReadModel({ ...assembleDecisionRoomInputs({ deal, now, ...extras }), previousRecalculation: previous?.recalculation });
  expect(result.success).toBe(true);
  return result.data;
}

beforeEach(() => { db.row = structuredClone(residential); db.writes = []; });

describe("durable RDI research loop", () => {
  it("persists a critical fact, source, verification, source time and actor in one scoped write and reloads identically", async () => {
    const result = await saveResearchCommand(db.row, record);
    expect(result.success).toBe(true);
    expect(db.row.arv).toBe(240000);
    expect(db.row.research_evidence[0]).toMatchObject({ sourceRecordId: record.source, verificationState: "verified", sourceTimestamp: record.sourceTimestamp, provenanceDetails: { actorReference: "operator-1", storedValue: 240000 } });
    const reloaded = JSON.parse(JSON.stringify(db.row));
    expect(assembleResearchContext(reloaded, now)).toEqual(assembleResearchContext(result.data, now));
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].table).toBe("deals");
    expect(Object.keys(db.writes[0].payload).sort()).toEqual(["arv", "research_evidence", "research_resolutions", "research_revision"]);
    expect(db.filters).toContainEqual(["organization_id", "org-1"]);
  });

  it("keeps competing values explicit, requires selection/reason, and durably resolves to the chosen source", async () => {
    db.row = { ...residential, arv: 200000 };
    const recorded = await saveResearchCommand(db.row, record);
    expect(recorded.success).toBe(true);
    expect(db.row.arv).toBe(200000);
    const open = evaluate(db.row);
    const conflict = open.conflictReadModel.activeConflicts.find((entry) => entry.canonicalField === record.field);
    expect(conflict.distinctNormalizedValues).toEqual(expect.arrayContaining([200000, 240000]));
    const candidate = conflict.candidateValues.find((entry) => entry.sourceRecordId === record.source);
    const command = { type: "resolve", field: record.field, candidateId: candidate.candidateId, reason: "Reviewed the dated appraisal." };
    expect(() => mutate(db.row, { ...command, reason: "" })).toThrow(/reason/);
    const resolved = await saveResearchCommand(db.row, command);
    expect(resolved.success).toBe(true);
    const reloaded = JSON.parse(JSON.stringify(db.row));
    expect(reloaded.arv).toBe(240000);
    expect(reloaded.research_evidence).toHaveLength(2);
    expect(reloaded.research_resolutions[0]).toMatchObject({ status: "resolved", selectedCandidateId: candidate.candidateId, actorReference: "operator-1", reason: command.reason });
    const after = evaluate(reloaded, open);
    expect(after.conflictReadModel.activeConflicts).toHaveLength(0);
    expect(after.conflictReadModel.resolvedConflicts).toHaveLength(1);
    expect(after.recalculation.state).toBe("recalculated");
    expect(evaluate(reloaded).recommendation).toEqual(evaluate(resolved.data).recommendation);
  });

  it("reopens resolved research on a new source or an outside CRM edit", () => {
    const recorded = mutate({ ...residential, arv: 200000 }, record);
    const conflict = assembleResearchContext(recorded, now).conflictReadModel.activeConflicts[0];
    const selected = conflict.candidateValues.find((entry) => entry.sourceRecordId === record.source);
    const resolved = mutate(recorded, { type: "resolve", field: record.field, candidateId: selected.candidateId, reason: "Verified appraisal" });
    expect(assembleResearchContext({ ...resolved, arv: 260000 }, now).conflictReadModel.activeConflicts).toHaveLength(1);
    const revised = mutate(resolved, { ...record, value: "250000", source: "Second appraisal" });
    expect(assembleResearchContext(revised, now).conflictReadModel.activeConflicts).toHaveLength(1);
  });

  it("persists verification updates without manufacturing a timestamp", () => {
    const initial = mutate(residential, { ...record, verificationState: "unverified", sourceTimestamp: "" });
    const verified = mutate(initial, { ...record, sourceTimestamp: "" });
    expect(verified.research_evidence).toHaveLength(1);
    expect(verified.research_evidence[0].verificationState).toBe("verified");
    expect(verified.research_evidence[0].sourceTimestamp).toBeNull();
    const dated = mutate(residential, record);
    expect(mutate(dated, { ...record, sourceTimestamp: "" }).research_evidence[0].sourceTimestamp).toBe(record.sourceTimestamp);
  });

  it("resolves Vacant Land legal access using the existing land conflict policy", () => {
    const land = { ...residential, asset_type: "vacant-residential-land", legal_access: "none", parcel_id: "APN-12" };
    const edited = mutate(land, { ...record, field: "property.legalAccess", value: "documented", source: "Recorded easement" });
    const before = evaluate(edited);
    const conflict = before.conflictReadModel.activeConflicts.find((entry) => entry.canonicalField === "property.legalAccess");
    const candidate = conflict.candidateValues.find((entry) => entry.sourceRecordId === "Recorded easement");
    const resolved = mutate(edited, { type: "resolve", field: "property.legalAccess", candidateId: candidate.candidateId, reason: "Reviewed recorded access" });
    expect(JSON.parse(JSON.stringify(resolved)).legal_access).toBe("documented");
    const after = evaluate(resolved, before);
    expect(after.recalculation.changedCategories).toContain("conflicts");
    expect(after.conflictReadModel.activeConflicts).toHaveLength(0);
    expect(after.vacantLandStrategyResult.factReadModel.factsById["legal-access"].value).toBeTruthy();
  });

  it("rejects stale saves, unrelated fields, cross-organization edits and malformed values", async () => {
    const stale = { ...db.row };
    await saveResearchCommand(db.row, record);
    expect((await saveResearchCommand(stale, record)).success).toBe(false);
    expect((await saveResearchCommand({ ...db.row, organization_id: "other" }, record)).success).toBe(false);
    for (const command of [{ ...record, field: "stage" }, { ...record, value: "unknown" }, { ...record, value: "$" }, { ...record, source: "" }]) {
      expect(() => mutate(residential, command)).toThrow();
    }
    const prior = { ...db.row };
    db.row.arv = 999999;
    expect((await saveResearchCommand(prior, record)).success).toBe(false);
  });

  it("declares only additive storage on the existing tenant-owned deal table", () => {
    const sql = readFileSync("supabase/migrations/202609230002_add_deal_research_resolution.sql", "utf8");
    expect(sql).toContain("add column research_evidence jsonb");
    expect(sql).toContain("add column research_resolutions jsonb");
    expect(sql).not.toMatch(/create table|create policy|security definer|disable row level/i);
  });
});

describe("canonical refresh and input assembly", () => {
  it("preserves unknown inputs and fail-safe unresolved/unverified facts", () => {
    const missing = evaluate(residential);
    expect(missing.readinessResult.state).not.toBe("ready-for-offer-preparation");
    expect(missing.residentialStrategyResult.underwriting?.acquisitionCeiling ?? null).toBeNull();
    const unresolved = evaluate(mutate({ ...residential, arv: 200000 }, record));
    expect(unresolved.conflictReadModel.blockingConflicts.length).toBeGreaterThan(0);
    const unverified = evaluate(mutate(residential, { ...record, verificationState: "unverified" }));
    expect(unverified.missingInformationReadModel.allItems.some((entry) => entry.canonicalField === record.field && entry.state === "unverified")).toBe(true);
  });

  it("classifies identical inputs and irrelevant CRM edits as unchanged", () => {
    const initial = evaluate(residential);
    expect(evaluate(structuredClone(residential), initial).recalculation.state).toBe("unchanged");
    expect(evaluate({ ...residential, notes: "new note", updated_at: now, lead_score: 99 }, initial).recalculation.changedCategories).toEqual([]);
    const unrelated = { evidenceId: "decor", sourceType: "manual-research", sourceSystem: "Notes", sourceRecordId: "note-1", relatedCanonicalField: "ui.decor", organizationId: "org-1", valueSummary: "blue" };
    expect(evaluate(residential, initial, { decisionContext: { evidenceReferences: [unrelated] } }).recalculation.state).toBe("unchanged");
  });

  it("refreshes changed approval and commitment inputs without mutating any source", () => {
    const deal = structuredClone(residential);
    const first = evaluate(deal);
    const tasks = [{ id: "task-1", deal_id: deal.id, title: "Call", status: "open", due_at: now }];
    const approvals = [{ id: "approval-1", dealId: deal.id, status: "pending" }];
    const after = evaluate(deal, first, { sellerTasks: tasks, decisionContext: { approvalItems: approvals } });
    expect(after.recalculation.changedCategories).toEqual(expect.arrayContaining(["commitments", "approvals"]));
    expect(deal).toEqual(residential);
    expect(tasks[0].status).toBe("open");
    expect(approvals[0].status).toBe("pending");
    expect(db.writes).toHaveLength(0);
  });

  it("refreshes fact, evidence and conflict changes with named input categories", () => {
    const initial = evaluate(residential);
    const edited = mutate(residential, record);
    const next = evaluate(edited, initial);
    expect(next.recalculation.state).toBe("recalculated");
    expect(next.recalculation.changedCategories).toEqual(expect.arrayContaining(["facts", "evidence"]));
    const unverified = evaluate(mutate(edited, { ...record, verificationState: "unverified" }), next);
    expect(unverified.recalculation.changedCategories).toContain("evidence");
    const conflicted = evaluate(mutate(edited, { ...record, value: "260000", source: "Other appraisal" }), next);
    expect(conflicted.recalculation.changedCategories).toContain("conflicts");
  });

  it("uses RDI-04 freshness boundaries at supplied evaluation time", () => {
    const researched = mutate(residential, record);
    const initial = evaluate(researched);
    const samePolicyState = evaluate(researched, initial, { now: "2026-09-23T16:01:00.000Z" });
    expect(samePolicyState.recalculation.state).toBe("unchanged");
    const stale = evaluate(researched, initial, { now: "2027-09-23T16:00:00.000Z" });
    expect(stale.freshnessReadModel.evaluatedTimestamp).toBe("2027-09-23T16:00:00.000Z");
    expect(stale.recalculation.changedCategories).toContain("freshness");
    expect(stale.freshnessReadModel.staleCanonicalFields.concat(stale.freshnessReadModel.expiredCanonicalFields)).toContain(record.field);
  });

  it("assembles linked operational records and keeps seller reply precedence over research conflict", () => {
    const deal = mutate({ ...residential, arv: 200000, next_action: "Call seller", next_action_due_date: "2026-09-22" }, record);
    const extras = {
      conversations: [{ linkedDealId: deal.id, phone: deal.phone, lastMessageDirection: "inbound", lastMessagePreview: "Please call", lastMessageTimestamp: now }, { linkedDealId: "other", phone: deal.phone, lastMessageDirection: "inbound" }],
      sellerTasks: [{ id: "task-1", deal_id: deal.id, title: "Call", due_at: now, status: "open" }, { id: "other", deal_id: "other" }],
      sequenceSteps: [{ id: "step-1", deal_id: deal.id, action_type: "Review", due_date: "2026-09-22", status: "Pending" }],
      decisionContext: { approvalItems: [{ id: "approval-1", dealId: deal.id, status: "pending" }] },
    };
    const inputs = assembleDecisionRoomInputs({ deal, now, ...extras });
    expect(inputs.tasks).toHaveLength(3);
    expect(inputs.conversationSignals).toHaveLength(1);
    const result = evaluate(deal, null, extras);
    expect(result.recommendationBasis.basisType).toBe("seller-reply");
    expect(result.approvalSummary.pendingCount).toBe(1);
    const changed = evaluate(deal, result, { ...extras, conversations: [] });
    expect(changed.recalculation.changedCategories).toContain("communication");
  });

  it("preserves Residential and Vacant Land canonical results with no research inputs", () => {
    for (const deal of [residential, { ...residential, asset_type: "vacant-residential-land", parcel_id: "APN-12", acreage: 1.5 }]) {
      const direct = buildCompatibilityDecisionReadModel({ deal, now });
      const assembled = evaluate(deal);
      expect(assembled.recommendation).toEqual(direct.data.recommendation);
      expect(assembled.readinessResult).toEqual(direct.data.readinessResult);
      expect(assembled.residentialStrategyResult).toEqual(direct.data.residentialStrategyResult);
      expect(assembled.vacantLandStrategyResult).toEqual(direct.data.vacantLandStrategyResult);
    }
  });

  it("does not execute the recommendation callback for unchanged inputs and has explicit unavailable state", () => {
    const compute = vi.fn(() => ({ recommendation: { actionCode: "review" } }));
    const first = refreshCanonicalRecommendation({ categories: { facts: { value: 1 } }, compute });
    expect(refreshCanonicalRecommendation({ categories: { facts: { value: 1 } }, previous: first, compute }).state).toBe("unchanged");
    expect(compute).toHaveBeenCalledTimes(1);
    expect(evaluate({}).recalculation.state).toBe("unavailable");
    expect(db.writes).toHaveLength(0);
  });
});
