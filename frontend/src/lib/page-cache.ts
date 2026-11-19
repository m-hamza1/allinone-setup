type Entry<T> = { value: T; at: number };

const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 60_000;

export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T) {
  store.set(key, { value, at: Date.now() });
}

export function cacheKey(token: string, ...parts: Array<string | number>) {
  return `${token.slice(0, 12)}:${parts.join(":")}`;
}
