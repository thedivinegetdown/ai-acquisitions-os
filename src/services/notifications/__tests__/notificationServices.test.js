import { describe, expect, it } from "vitest";
import {
  buildActionInbox,
  dismissNotification,
  markNotificationCompleted,
  markNotificationSeen,
} from "../index";

const riskyDeal = {
  id: "deal-1",
  property_address: "123 Main",
  stage: "New Lead",
  due_date: "2000-01-01",
};

describe("notification services", () => {
  it("generates active notifications from loaded deal data", () => {
    const inbox = buildActionInbox({ deals: [riskyDeal] });

    expect(inbox.notifications.length).toBeGreaterThan(0);
    expect(inbox.summary).toContain("active notifications");
  });

  it("applies local notification state transitions", () => {
    let state = {};
    state = markNotificationSeen(state, "n1");
    state = markNotificationCompleted(state, "n1");
    state = dismissNotification(state, "n2");

    expect(state.n1.status).toBe("Completed");
    expect(state.n2.status).toBe("Dismissed");
  });
});
