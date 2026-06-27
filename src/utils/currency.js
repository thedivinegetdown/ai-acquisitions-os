import { parseSafeNumber } from "./numbers";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(value, fallback = "Missing") {
  const amount = parseSafeNumber(value);

  if (amount === null) return fallback;

  return usdFormatter.format(amount);
}

export function formatNonNegativeUsd(value, fallback = "Missing") {
  const amount = parseSafeNumber(value);

  if (amount === null) return fallback;

  return usdFormatter.format(Math.max(0, amount));
}

export function centsToUsd(cents, fallback = "Missing") {
  const amount = parseSafeNumber(cents);

  if (amount === null) return fallback;

  return formatUsd(amount / 100, fallback);
}
