import { describe, expect, it } from "vitest";
import {
  buildActionInbox,
  dismissNotification,
  markNotificationCompleted,
  markNotificationSeen,
} from "../index";
import { afterEach, vi } from "vitest";

const riskyDeal = {
  id: "deal-1",
  property_address: "123 Main",
  stage: "New Lead",
  due_date: "2000-01-01",
};

const scheduledDeal = {
  ...riskyDeal,
  owner_name: "Alex Seller",
  phone: "+15555550100",
  next_action: "Follow up",
  due_date: "2026-08-10",
};

afterEach(() => {
  vi.useRealTimers();
});

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

  it.each([
    ["2026-08-04T12:00:00.000Z", null],
    ["2026-08-10T12:00:00.000Z", "Follow-ups due"],
    ["2026-08-11T12:00:00.000Z", "Overdue tasks"],
  ])("classifies follow-ups against supplied time %s", (now, expectedCategory) => {
    const inbox = buildActionInbox({ deals: [scheduledDeal], now });
    const dateCategories = inbox.notifications
      .map((notification) => notification.category)
      .filter((category) => ["Follow-ups due", "Overdue tasks"].includes(category));

    expect(dateCategories).toEqual(expectedCategory ? [expectedCategory] : []);
    expect(inbox.generatedAt).toBe(now);
  });

  it("produces identical output for the same supplied time on different wall-clock dates", () => {
    const now = "2026-08-04T12:00:00.000Z";
    vi.useFakeTimers();
    vi.setSystemTime("2030-01-01T00:00:00.000Z");
    const first = buildActionInbox({ deals: [scheduledDeal], now });
    vi.setSystemTime("2040-12-31T23:59:59.000Z");
    const second = buildActionInbox({ deals: [scheduledDeal], now });

    expect(second).toEqual(first);
  });
});
