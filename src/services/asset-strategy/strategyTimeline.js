import { parseSafeNumber } from "../../utils/numbers";
import { compactText } from "../../utils/text";
import { INFORMATION_STATES } from "../research-intelligence/missingInformationContracts";

// Distinct responsibility: provide one asset-neutral deterministic seller
// timeline parser and score mapping for concrete acquisition strategies.
const UNKNOWN_TEXT = new Set([
  "unknown",
  "not sure",
  "unsure",
  "tbd",
  "n/a",
  "na",
]);

const TIMELINE_TEXT_DAYS = Object.freeze({
  immediate: 0,
  immediately: 0,
  asap: 0,
  now: 0,
  "within 30 days": 30,
  "30 days": 30,
  "this month": 30,
  "60 days": 60,
  "two months": 60,
  "90 days": 90,
  "three months": 90,
  "three to six months": 180,
  "within six months": 180,
  "six months or more": 181,
  "just exploring": 181,
});

function normalizedText(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return compactText(String(value)).toLowerCase();
}

export function normalizeStrategyTimeline(value, evaluatedTimestamp) {
  const numeric = parseSafeNumber(value);
  if (numeric !== null && numeric >= 0) {
    return {
      state: INFORMATION_STATES.PRESENT,
      days: numeric,
      method: "numeric-days",
    };
  }

  const text = normalizedText(value);
  if (!text) {
    return { state: INFORMATION_STATES.MISSING, days: null, method: null };
  }
  if (UNKNOWN_TEXT.has(text)) {
    return {
      state: INFORMATION_STATES.UNKNOWN,
      days: null,
      method: "explicit-unknown",
    };
  }
  if (Object.hasOwn(TIMELINE_TEXT_DAYS, text)) {
    return {
      state: INFORMATION_STATES.PRESENT,
      days: TIMELINE_TEXT_DAYS[text],
      method: "narrow-text-mapping",
    };
  }

  const target = new Date(value);
  const evaluated = evaluatedTimestamp ? new Date(evaluatedTimestamp) : null;
  if (
    Number.isFinite(target.getTime()) &&
    evaluated &&
    Number.isFinite(evaluated.getTime())
  ) {
    return {
      state: INFORMATION_STATES.PRESENT,
      days: Math.max(
        0,
        Math.ceil((target.getTime() - evaluated.getTime()) / 86400000)
      ),
      method: "target-date",
    };
  }

  return {
    state: INFORMATION_STATES.UNKNOWN,
    days: null,
    method: "ambiguous-text",
  };
}

export function scoreStrategyTimelineDays(value) {
  const days = parseSafeNumber(value);
  if (days === null || days < 0) return null;
  if (days <= 30) return 100;
  if (days <= 60) return 85;
  if (days <= 90) return 70;
  if (days <= 180) return 45;
  return 25;
}
