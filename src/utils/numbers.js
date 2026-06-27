export function parseSafeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[$,%\s,]/g, "");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parsePositiveNumber(value, fallback = null) {
  const parsed = parseSafeNumber(value, fallback);

  return parsed !== null && parsed !== undefined && parsed > 0
    ? parsed
    : fallback;
}

export function clampNumber(value, min, max) {
  const parsed = parseSafeNumber(value, min);

  return Math.max(min, Math.min(max, parsed));
}

export function clampScore(value) {
  return Math.round(clampNumber(value, 0, 100));
}

export function toPercent(numerator, denominator) {
  const safeNumerator = parseSafeNumber(numerator, 0);
  const safeDenominator = parseSafeNumber(denominator, 0);

  if (!safeDenominator) return 0;

  return Math.round((safeNumerator / safeDenominator) * 100);
}

export function hasPositiveNumber(value) {
  return parsePositiveNumber(value) !== null;
}
