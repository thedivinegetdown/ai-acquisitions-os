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

export function formatDateOnly(value, fallback = "No date") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return fallback;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const isExactDate =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return isExactDate ? date.toLocaleDateString() : fallback;
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
