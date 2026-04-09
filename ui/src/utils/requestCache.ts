type CacheEnvelope<T> = {
  expiry: number;
  value: T;
};

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();
// SessionStorage 前缀统一挂到 Fantetic Nav 名下，确保品牌改名后的缓存空间彼此隔离。
const STORAGE_PREFIX = "fantetic-nav-request-cache:";

const getStorageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const isExpired = (record: CacheEnvelope<unknown>) => record.expiry <= Date.now();

const removeExpiredCache = (key: string) => {
  memoryCache.delete(key);
  window.sessionStorage.removeItem(getStorageKey(key));
};

const readStorageCache = <T>(key: string): CacheEnvelope<T> | null => {
  const raw = window.sessionStorage.getItem(getStorageKey(key));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.expiry !== "number" || isExpired(parsed as CacheEnvelope<unknown>)) {
      removeExpiredCache(key);
      return null;
    }
    return parsed;
  } catch {
    removeExpiredCache(key);
    return null;
  }
};

export const readRequestCache = <T>(key: string): T | null => {
  const memoryRecord = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (memoryRecord) {
    if (isExpired(memoryRecord as CacheEnvelope<unknown>)) {
      removeExpiredCache(key);
      return null;
    }
    return memoryRecord.value;
  }

  const storageRecord = readStorageCache<T>(key);
  if (!storageRecord) {
    return null;
  }

  // 命中 sessionStorage 后同步回内存，减少同页多次 JSON 解析成本。
  memoryCache.set(key, storageRecord as CacheEnvelope<unknown>);
  return storageRecord.value;
};

export const writeRequestCache = <T>(key: string, value: T, ttlMs: number) => {
  const record: CacheEnvelope<T> = {
    expiry: Date.now() + ttlMs,
    value,
  };
  memoryCache.set(key, record as CacheEnvelope<unknown>);
  window.sessionStorage.setItem(getStorageKey(key), JSON.stringify(record));
};

export const clearRequestCache = (key?: string) => {
  if (key) {
    removeExpiredCache(key);
    inflightRequests.delete(key);
    return;
  }

  Array.from(memoryCache.keys()).forEach((itemKey) => removeExpiredCache(itemKey));
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = window.sessionStorage.key(index);
    if (storageKey?.startsWith(STORAGE_PREFIX)) {
      window.sessionStorage.removeItem(storageKey);
    }
  }
  memoryCache.clear();
  inflightRequests.clear();
};

export const loadWithCache = async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>) => {
  const cached = readRequestCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const pending = inflightRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  // 并发请求共用同一条 Promise，避免首页初始化阶段重复打接口。
  const request = fetcher()
    .then((value) => {
      writeRequestCache(key, value, ttlMs);
      inflightRequests.delete(key);
      return value;
    })
    .catch((error) => {
      inflightRequests.delete(key);
      throw error;
    });

  inflightRequests.set(key, request as Promise<unknown>);
  return request;
};
