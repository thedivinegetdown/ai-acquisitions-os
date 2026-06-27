export function toSafeDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSafeDate(value, fallback = "No date") {
  const date = toSafeDate(value);

  if (!date) return fallback;

  return date.toLocaleString();
}

export function hoursSince(value, now = Date.now()) {
  const date = toSafeDate(value);

  if (!date) return null;

  return (now - date.getTime()) / (1000 * 60 * 60);
}

export function daysSince(value, now = Date.now()) {
  const hours = hoursSince(value, now);

  if (hours === null) return null;

  return Math.floor(hours / 24);
}

export function isPastDate(value, now = Date.now()) {
  const date = toSafeDate(value);

  return date ? date.getTime() < now : false;
}
