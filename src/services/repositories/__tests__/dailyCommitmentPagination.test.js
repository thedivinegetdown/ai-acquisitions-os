import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, responses } = vi.hoisted(() => {
  const responses = { seller_tasks: [], sequences: [] };
  const from = vi.fn((table) => {
    const query = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.range = vi.fn(() => Promise.resolve(responses[table].shift()));
    query.limit = vi.fn(() => Promise.resolve(responses[table].shift()));
    return query;
  });
  return { from, responses };
});

vi.mock("../../../supabaseClient", () => ({ supabase: { from } }));
vi.mock("../../organizations", () => ({
  requireActiveOrganizationContext: vi.fn().mockResolvedValue({ organizationId: "org-1" }),
  stripOrganizationOwnership: (payload) => payload,
}));

import { listSellerTasks } from "../sellerTaskRepository";
import { listSequenceSteps } from "../workflowRepository";

describe("Today commitment repository pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.seller_tasks.length = 0;
    responses.sequences.length = 0;
  });

  it("loads every deterministic tenant page for tasks and sequence steps", async () => {
    const taskPage = Array.from({ length: 200 }, (_, index) => ({ id: `task-${index}` }));
    const sequencePage = Array.from({ length: 200 }, (_, index) => ({ id: `step-${index}` }));
    responses.seller_tasks.push(
      { data: taskPage, error: null },
      { data: [{ id: "task-200" }], error: null }
    );
    responses.sequences.push(
      { data: sequencePage, error: null },
      { data: [{ id: "step-200" }], error: null }
    );

    const [tasks, steps] = await Promise.all([listSellerTasks(), listSequenceSteps()]);

    expect(tasks.success).toBe(true);
    expect(tasks.data).toHaveLength(201);
    expect(new Set(tasks.data.map((row) => row.id)).size).toBe(201);
    expect(steps.success).toBe(true);
    expect(steps.data).toHaveLength(201);
    expect(new Set(steps.data.map((row) => row.id)).size).toBe(201);

    const queriesFor = (table) => from.mock.results
      .filter((result, index) => from.mock.calls[index][0] === table)
      .map((result) => result.value);
    const taskQueries = queriesFor("seller_tasks");
    const sequenceQueries = queriesFor("sequences");
    expect(taskQueries[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(taskQueries[0].order).toHaveBeenCalledWith("due_at", { ascending: true });
    expect(taskQueries[0].order).toHaveBeenCalledWith("id", { ascending: true });
    expect(taskQueries.flatMap((query) => query.range.mock.calls)).toEqual([[0, 199], [200, 399]]);
    expect(sequenceQueries[0].eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(sequenceQueries[0].order).toHaveBeenCalledWith("due_date", { ascending: true });
    expect(sequenceQueries[0].order).toHaveBeenCalledWith("id", { ascending: true });
    expect(sequenceQueries.flatMap((query) => query.range.mock.calls)).toEqual([[0, 199], [200, 399]]);
  });
});
