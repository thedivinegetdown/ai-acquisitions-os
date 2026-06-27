import { describe, expect, it } from "vitest";
import { centsToUsd, formatNonNegativeUsd, formatUsd } from "../currency";
import { daysSince, formatSafeDate, hoursSince } from "../dates";
import {
  getDealAlias,
  getDealAliasPositiveNumber,
  getDealAliasText,
} from "../dealFields";
import {
  clampScore,
  parsePositiveNumber,
  parseSafeNumber,
  toPercent,
} from "../numbers";
import { normalizePhone, normalizePhoneE164, phonesMatch } from "../phone";
import {
  compactText,
  findKeywordMatches,
  normalizeText,
  safeTrim,
  uniqueStrings,
} from "../text";

describe("number utilities", () => {
  it("parses safe numbers and clamps scores", () => {
    expect(parseSafeNumber("$1,250")).toBe(1250);
    expect(parseSafeNumber("bad", 7)).toBe(7);
    expect(parsePositiveNumber("-1", null)).toBeNull();
    expect(clampScore(125.7)).toBe(100);
    expect(clampScore(-4)).toBe(0);
    expect(toPercent(1, 4)).toBe(25);
    expect(toPercent(1, 0)).toBe(0);
  });
});

describe("currency utilities", () => {
  it("formats USD safely", () => {
    expect(formatUsd(1250)).toBe("$1,250");
    expect(formatUsd(null)).toBe("Missing");
    expect(formatNonNegativeUsd(-10)).toBe("$0");
    expect(centsToUsd(12345)).toBe("$123");
  });
});

describe("date utilities", () => {
  it("handles invalid and valid dates safely", () => {
    expect(formatSafeDate("not-a-date", "Fallback")).toBe("Fallback");
    expect(hoursSince("")).toBeNull();
    expect(daysSince("")).toBeNull();
  });
});

describe("phone utilities", () => {
  it("normalizes and compares phones", () => {
    expect(normalizePhone("+1 (555) 123-4567")).toBe("5551234567");
    expect(normalizePhoneE164("5551234567")).toBe("+15551234567");
    expect(phonesMatch("+1 555-123-4567", "(555) 123-4567")).toBe(true);
  });
});

describe("text utilities", () => {
  it("trims, compacts, matches, and uniques safely", () => {
    expect(safeTrim("  hello  ")).toBe("hello");
    expect(normalizeText(" HeLLo ")).toBe("hello");
    expect(compactText("hello   world")).toBe("hello world");
    expect(findKeywordMatches("Need repairs ASAP", ["repairs", "cash"])).toEqual([
      "repairs",
    ]);
    expect(uniqueStrings(["a", "a", "", "b"])).toEqual(["a", "b"]);
  });
});

describe("deal field aliases", () => {
  it("reads inconsistent deal fields", () => {
    const deal = {
      seller_name: "Jane",
      asking_price: "100000",
      property_address: "123 Main",
    };

    expect(getDealAlias(deal, "address")).toBe("123 Main");
    expect(getDealAliasText(deal, "ownerName")).toBe("Jane");
    expect(getDealAliasPositiveNumber(deal, "askingPrice")).toBe(100000);
  });
});
