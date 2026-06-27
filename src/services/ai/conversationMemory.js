const memory = new Map();

export function getConversationMemory(key) {
  return memory.get(key) || [];
}

export function appendConversationMemory(key, entry) {
  if (!key || !entry) return [];

  const current = getConversationMemory(key);
  const next = [
    ...current,
    {
      ...entry,
      timestamp: new Date().toISOString(),
    },
  ].slice(-20);

  memory.set(key, next);
  return next;
}

export function clearConversationMemory(key) {
  if (key) {
    memory.delete(key);
    return;
  }

  memory.clear();
}
