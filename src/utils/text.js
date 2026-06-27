export function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeText(value) {
  return safeTrim(value).toLowerCase();
}

export function compactText(value) {
  return safeTrim(value).replace(/\s+/g, " ");
}

export function hasText(value) {
  return safeTrim(value).length > 0;
}

export function findKeywordMatches(text, keywords = []) {
  const normalized = normalizeText(text);

  if (!normalized) return [];

  return keywords.filter((keyword) =>
    normalized.includes(normalizeText(keyword))
  );
}

export function uniqueStrings(values = []) {
  return [...new Set(values.filter(hasText))];
}
