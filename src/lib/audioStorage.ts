/**
 * TTS audio storage backed by IndexedDB.
 *
 * @remarks
 * Ported from Wordmark's `audioStorage`. Synthesized speech is cached keyed by
 * message so a clip can be replayed — across reloads and conversation switches —
 * without re-calling (and re-paying) the provider. The store is pruned to the
 * {@link MAX_STORED_AUDIO} most recent clips. It lives in its own database,
 * separate from the Zustand store, and is never included in data exports.
 */

const AUDIO_DB_NAME = 'darkwords-audio';
const AUDIO_DB_VERSION = 1;
const AUDIO_STORE = 'tts-audio';
/** Maximum number of clips retained before the oldest are pruned. */
const MAX_STORED_AUDIO = 15;

/** A TTS audio clip as persisted in the audio store. */
export interface StoredAudio {
  id: string;
  messageId: string;
  voice: string;
  text: string;
  data: ArrayBuffer;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** Opens (once) the audio database, or resolves `null` where IndexedDB is absent (e.g. tests). */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const store = db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        store.createIndex('messageId', 'messageId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.error('Failed to open TTS audio database:', req.error);
      resolve(null);
    };
  });
  return dbPromise;
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persists a synthesized clip and prunes older ones. A no-op without IndexedDB. */
export async function saveAudio(messageId: string, voice: string, text: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const record: StoredAudio = { id: `${messageId}_${Date.now()}`, messageId, voice, text, data, timestamp: Date.now() };
  const tx = db.transaction(AUDIO_STORE, 'readwrite');
  tx.objectStore(AUDIO_STORE).add(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
  await pruneAudio().catch((err) => console.warn('Error pruning TTS audio:', err));
}

/** Loads the newest stored clip for a message, or `null` when none is stored. */
export async function loadAudio(messageId: string): Promise<StoredAudio | null> {
  const db = await openDb();
  if (!db) return null;
  const index = db.transaction(AUDIO_STORE, 'readonly').objectStore(AUDIO_STORE).index('messageId');
  const results = await promisify(index.getAll(messageId));
  if (!results.length) return null;
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results[0];
}

/** Deletes clips beyond the {@link MAX_STORED_AUDIO} most recent. */
export async function pruneAudio(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const store = db.transaction(AUDIO_STORE, 'readonly').objectStore(AUDIO_STORE);
  const all = await promisify<StoredAudio[]>(store.getAll());
  if (all.length <= MAX_STORED_AUDIO) return;
  all.sort((a, b) => b.timestamp - a.timestamp);
  const stale = all.slice(MAX_STORED_AUDIO);
  const tx = db.transaction(AUDIO_STORE, 'readwrite');
  const del = tx.objectStore(AUDIO_STORE);
  for (const rec of stale) del.delete(rec.id);
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

/** Deletes every stored clip. */
export async function clearAudio(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(AUDIO_STORE, 'readwrite');
  tx.objectStore(AUDIO_STORE).clear();
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}
