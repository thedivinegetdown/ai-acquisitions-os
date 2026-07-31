import { describe, expect, it } from "vitest";
import {
  getDealIdFromRoute,
  getDealRoute,
  getWorkspaceByRoute,
  mobileWorkspaceIds,
  normalizeWorkspaceRoute,
  workspaceDefinitions,
} from "../workspaces";

describe("workspaceDefinitions", () => {
  it("defines the approved primary navigation contract", () => {
    expect(workspaceDefinitions.map((workspace) => workspace.id)).toEqual([
      "today",
      "pipeline",
      "inbox",
      "deals",
      "buyers",
      "reports",
      "settings",
    ]);

    for (const workspace of workspaceDefinitions) {
      expect(workspace).toEqual(
        expect.objectContaining({
          ariaLabel: expect.any(String),
          icon: expect.any(String),
          id: expect.any(String),
          label: expect.any(String),
          route: expect.stringMatching(/^\//),
        })
      );
    }
  });

  it("maps routes and unknown paths safely", () => {
    expect(normalizeWorkspaceRoute("/")).toBe("/today");
    expect(getWorkspaceByRoute("/pipeline")?.id).toBe("pipeline");
    expect(getWorkspaceByRoute("/pipeline/")?.id).toBe("pipeline");
    expect(getWorkspaceByRoute("/unknown")).toBeNull();
  });

  it("maps deal routes to the route-level Deal Decision Room", () => {
    expect(getDealRoute("deal-123")).toBe("/deals/deal-123");
    expect(getDealIdFromRoute("/deals/deal-123")).toBe("deal-123");
    expect(getWorkspaceByRoute("/deals/deal-123")?.id).toBe("deal-decision-room");
    expect(getWorkspaceByRoute("/deals")?.id).toBe("deals");
  });

  it("keeps mobile navigation focused on Today, Pipeline, Inbox, and More", () => {
    expect(mobileWorkspaceIds).toEqual(["today", "pipeline", "inbox"]);
  });
});
