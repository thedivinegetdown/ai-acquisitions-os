export function normalizePhone(value) {
  if (!value) return "";

  const digits = String(value).replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits;
}

export function normalizePhoneE164(value, countryCode = "1") {
  const normalized = normalizePhone(value);

  if (!normalized) return "";

  if (normalized.length === 10) {
    return `+${countryCode}${normalized}`;
  }

  return normalized.startsWith(countryCode)
    ? `+${normalized}`
    : `+${countryCode}${normalized}`;
}

export function phonesMatch(left, right) {
  const normalizedLeft = normalizePhone(left);
  const normalizedRight = normalizePhone(right);

  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

export function hasPhone(value) {
  return normalizePhone(value).length >= 10;
}
