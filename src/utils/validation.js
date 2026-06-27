import { hasPhone } from "./phone";

export function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function safeString(value, maxLength = 1000) {
  if (!hasText(value)) return "";
  return String(value).trim().slice(0, maxLength);
}

export function isValidEmail(value = "") {
  if (!hasText(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function isOptionalEmail(value = "") {
  return !hasText(value) || isValidEmail(value);
}

export function isOptionalPhone(value = "") {
  return !hasText(value) || hasPhone(value);
}

export function isOneOf(value, allowedValues = []) {
  return allowedValues.includes(value);
}

export function toFiniteNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
