const cache = new Map();

export function getCachedValue(key) {
  const entry = cache.get(key);

  if (!entry) return null;

  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function setCachedValue(key, value, ttlMs = 30000) {
  cache.set(key, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
  });

  return value;
}

export async function getOrSetCachedValue(key, loader, ttlMs = 30000) {
  const cachedValue = getCachedValue(key);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const value = await loader();
  setCachedValue(key, value, ttlMs);
  return value;
}

export function clearCache(key) {
  if (key) {
    cache.delete(key);
    return;
  }

  cache.clear();
}

export function clearCacheByPrefix(prefix) {
  if (!prefix) return;

  Array.from(cache.keys()).forEach((key) => {
    if (String(key).startsWith(prefix)) {
      cache.delete(key);
    }
  });
}
