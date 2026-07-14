import type { StateStorage } from 'zustand/middleware';

/**
 * IndexedDB-backed storage for the persisted store.
 *
 * localStorage caps out around 5 MB, and Darkwords stores real image bytes —
 * generated images, uploaded attachments — as base64 data URLs. A couple of
 * generated PNGs blow the quota and every subsequent write throws. IndexedDB has
 * no such practical limit.
 */

const DB_NAME = 'darkwords';
const DB_VERSION = 1;
const STORE = 'state';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/**
 * Writes are debounced: the persist middleware serializes the whole store on
 * every setState, which during streaming means one multi-megabyte JSON string
 * per token delta. Only the latest value per key is kept and written after a
 * quiet period (or when the page is hidden), so streaming costs one IndexedDB
 * write instead of hundreds.
 */
const WRITE_DEBOUNCE_MS = 500;

const pendingWrites = new Map<string, { value: string; timer: ReturnType<typeof setTimeout> }>();

function flushWrite(name: string): Promise<void> {
  const pending = pendingWrites.get(name);
  if (!pending) return Promise.resolve();
  pendingWrites.delete(name);
  clearTimeout(pending.timer);
  return run('readwrite', (store) => store.put(pending.value, name)).then(() => undefined);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      for (const name of pendingWrites.keys()) void flushWrite(name);
    }
  });
}

export const idbStorage: StateStorage = {
  async getItem(name) {
    await flushWrite(name);
    const stored = await run<string | undefined>('readonly', (store) => store.get(name));
    if (stored !== undefined) return stored;

    try {
      const legacy = localStorage.getItem(name);
      if (legacy) {
        await run('readwrite', (store) => store.put(legacy, name));
        localStorage.removeItem(name);
        return legacy;
      }
    } catch {
    }
    return null;
  },

  setItem(name, value) {
    const pending = pendingWrites.get(name);
    if (pending) clearTimeout(pending.timer);
    pendingWrites.set(name, {
      value,
      timer: setTimeout(() => void flushWrite(name), WRITE_DEBOUNCE_MS),
    });
    return Promise.resolve();
  },

  async removeItem(name) {
    const pending = pendingWrites.get(name);
    if (pending) {
      clearTimeout(pending.timer);
      pendingWrites.delete(name);
    }
    await run('readwrite', (store) => store.delete(name));
  },
};

/** Bytes currently used by the persisted store, for the Data panel. */
export async function storageUsage(): Promise<number> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage) return estimate.usage;
  } catch {
  }
  const stored = await run<string | undefined>('readonly', (store) => store.get('darkwords-store'));
  return stored ? new Blob([stored]).size : 0;
}
