import { describe, expect, it } from "vitest";
import {
  analyzeOfferRange,
  analyzeOfferReadiness,
  analyzeOfferStrategy,
} from "../index";

describe("offer readiness service", () => {
  it("handles missing deal data safely", () => {
    const analysis = analyzeOfferReadiness(null);

    expect(analysis.score).toBe(0);
    expect(analysis.status).toBe("Not Ready");
    expect(analysis.checklist.every((item) => item.complete === false)).toBe(true);
  });

  it("marks complete data as ready", () => {
    const analysis = analyzeOfferReadiness({
      asking_price: 100000,
      property_condition: "Needs repairs",
      motivation_score: 8,
      seller_timeline: "ASAP",
      mortgage_status: "Current",
      repairs_needed: 20000,
      occupancy_status: "Vacant",
      arv: 180000,
    });

    expect(analysis.score).toBe(100);
    expect(analysis.status).toBe("Ready to Offer");
  });
});

describe("offer range service", () => {
  it("returns low confidence when ARV is missing", () => {
    const analysis = analyzeOfferRange({ repairs: 10000 });

    expect(analysis.confidence).toBe("Low");
    expect(analysis.offers).toBeNull();
  });

  it("calculates ranges with repair fallback", () => {
    const analysis = analyzeOfferRange({ arv: 200000, repairs: 20000 });

    expect(analysis.confidence).toBe("High");
    expect(analysis.offers.target).toBe(110000);
  });
});

describe("offer strategy service", () => {
  it("handles malformed messages and missing deal data", () => {
    const analysis = analyzeOfferStrategy({ deal: null, messages: null });

    expect(analysis.posture).toBeTruthy();
    expect(analysis.missing).toContain("ARV / comps");
    expect(analysis.factors.length).toBeGreaterThan(0);
  });

  it("detects stronger buyer leverage signals", () => {
    const analysis = analyzeOfferStrategy({
      deal: {
        motivation_score: 9,
        seller_timeline: "Need to sell this week",
        arv: 200000,
        repairs: 40000,
        occupancy_status: "Vacant",
        asking_price: 100000,
      },
      messages: [{ direction: "inbound", message: "I need help soon" }],
    });

    expect(["High", "Medium"]).toContain(analysis.buyerLeverage);
    expect(analysis.factors.length).toBeGreaterThan(1);
  });
});
