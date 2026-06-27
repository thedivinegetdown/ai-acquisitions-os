const propertyDataCache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function getCacheKey(input = {}) {
  return String(input.address || input.normalizedAddress || "").toLowerCase();
}

export function getCachedPropertyData(input = {}) {
  const key = getCacheKey(input);
  if (!key) return null;

  const cached = propertyDataCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    propertyDataCache.delete(key);
    return null;
  }

  return cached.value;
}

export function setCachedPropertyData(input = {}, value, ttlMs = DEFAULT_TTL_MS) {
  const key = getCacheKey(input);
  if (!key || !value) return value;

  propertyDataCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export function clearPropertyDataCache() {
  propertyDataCache.clear();
}
