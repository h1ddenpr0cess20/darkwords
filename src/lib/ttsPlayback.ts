/**
 * Per-message TTS playback controller.
 *
 * @remarks
 * A single module-level controller owns all voice audio so only one clip plays
 * at a time and its state can be shared across React components. Each assistant
 * message is keyed by id; components read its status through {@link useTtsState}
 * (a `useSyncExternalStore` binding) and drive it with {@link ttsPlayback}.
 *
 * Audio is synthesized on demand and cached in memory for the session — kept as
 * an object URL plus its backing bytes so the same clip can be replayed or
 * downloaded without a second API call. Nothing is persisted; switching the
 * conversation or reloading re-synthesizes on next play.
 */

import { clearAudio, loadAudio, saveAudio } from './audioStorage';
import { generateSpeech } from './tts';

export type TtsStatus = 'idle' | 'loading' | 'playing' | 'paused';

/** Immutable per-message snapshot handed to React; replaced only on change. */
export interface TtsState {
  status: TtsStatus;
  /** Set when the last synthesis or playback attempt failed. */
  error?: string;
}

/** Everything the controller needs to synthesize a clip for a message. */
export interface SpeakOpts {
  apiKey: string;
  text: string;
  voice: string;
  instructions?: string;
}

interface Cached {
  url: string;
  data: ArrayBuffer;
  /** The voice the cached clip was rendered with; a change forces a re-render. */
  voice: string;
}

const IDLE: TtsState = { status: 'idle' };

/** Reserved key for the Settings → Voice "Test voice" preview clip. */
export const TTS_SAMPLE_ID = '__tts_sample__';

class TtsController {
  private audios = new Map<string, HTMLAudioElement>();
  private cache = new Map<string, Cached>();
  private states = new Map<string, TtsState>();
  private listeners = new Map<string, Set<() => void>>();
  private activeId: string | null = null;
  private queue: string[] = [];
  private queueOpts = new Map<string, SpeakOpts>();
  private draining = false;

  /** Optional sink for user-facing synthesis errors (wired to a toast, etc.). */
  onError: ((message: string) => void) | null = null;

  subscribe(id: string, listener: () => void): () => void {
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.listeners.delete(id);
    };
  }

  getState(id: string): TtsState {
    return this.states.get(id) ?? IDLE;
  }

  private setState(id: string, next: TtsState): void {
    this.states.set(id, next);
    this.listeners.get(id)?.forEach((l) => {
      l();
    });
  }

  /** Toggles playback for a message: synthesize + play, pause, or resume. */
  async toggle(id: string, opts: SpeakOpts): Promise<void> {
    const status = this.getState(id).status;
    if (status === 'loading') return;

    if (status === 'playing') {
      this.audios.get(id)?.pause();
      this.setState(id, { status: 'paused' });
      if (this.activeId === id) this.activeId = null;
      return;
    }

    const cached = this.cache.get(id);
    if (cached && cached.voice === opts.voice) {
      await this.start(id);
      return;
    }

    await this.play(id, opts);
  }

  /**
   * Synthesizes and plays a one-off preview clip (the voice tester). Always
   * fresh and never persisted — it's a throwaway sample, not a message.
   */
  async playSample(opts: SpeakOpts): Promise<void> {
    this.evict(TTS_SAMPLE_ID);
    await this.play(TTS_SAMPLE_ID, opts, { store: false });
  }

  /** Stops whatever clip is currently playing, if any. */
  stopActive(): void {
    if (this.activeId) this.stop(this.activeId);
  }

  /** Stops playback and drops every clip — session cache and the IndexedDB store. */
  async clearAll(): Promise<void> {
    this.stopActive();
    for (const id of [...this.cache.keys()]) {
      this.evict(id);
      this.setState(id, { status: 'idle' });
    }
    await clearAudio();
  }

  /** Stops a message's audio and resets it to the start. */
  stop(id: string): void {
    const audio = this.audios.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (this.activeId === id) this.activeId = null;
    this.setState(id, { status: 'idle' });
  }

  /** Whether a clip for `id` is already in the session cache. */
  hasAudio(id: string): boolean {
    return this.cache.get(id) !== undefined;
  }

  /**
   * Returns the WAV bytes for a message — from the session cache, then the
   * IndexedDB store, and only synthesizing as a last resort. Used by download.
   */
  async getAudioData(id: string, opts: SpeakOpts): Promise<ArrayBuffer | null> {
    const cached = this.cache.get(id);
    if (cached && cached.voice === opts.voice) return cached.data;
    const ok = await this.resolveAudio(id, opts);
    return ok ? (this.cache.get(id)?.data ?? null) : null;
  }

  /** Queues a message for sequential autoplay; starts draining if idle. */
  enqueue(id: string, opts: SpeakOpts): void {
    if (this.cache.has(id) || this.queueOpts.has(id)) return;
    this.queue.push(id);
    this.queueOpts.set(id, opts);
    void this.drain();
  }

  /**
   * Plays the queue one clip at a time. Single-flight (guarded by `draining`)
   * and it returns while a clip is still playing — `handleEnded` re-drains once
   * the active clip finishes, so nothing plays over anything else.
   */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        if (this.activeId) return;
        const id = this.queue.shift();
        if (!id) continue;
        const opts = this.queueOpts.get(id);
        this.queueOpts.delete(id);
        if (!opts) continue;
        await this.play(id, opts);
        return;
      }
    } finally {
      this.draining = false;
    }
  }

  private async play(id: string, opts: SpeakOpts, { store = true } = {}): Promise<void> {
    this.setState(id, { status: 'loading' });
    const ok = await this.resolveAudio(id, opts, store);
    if (!ok) return;
    await this.start(id);
  }

  /**
   * Ensures a playable clip for `id` at the requested voice is in the session
   * cache: reuse the cache, else rehydrate from IndexedDB, else synthesize once
   * (persisting the result). Returns whether a clip is ready.
   */
  private async resolveAudio(id: string, opts: SpeakOpts, store = true): Promise<boolean> {
    const cached = this.cache.get(id);
    if (cached && cached.voice === opts.voice) return true;

    if (store) {
      try {
        const stored = await loadAudio(id);
        if (stored && stored.voice === opts.voice) {
          this.hydrate(id, stored.data, stored.voice);
          return true;
        }
      } catch (err) {
        console.warn('Could not read stored TTS audio:', err);
      }
    }

    try {
      const data = await generateSpeech(opts);
      this.hydrate(id, data, opts.voice);
      if (store) void saveAudio(id, opts.voice, opts.text, data).catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState(id, { status: 'idle', error: message });
      this.onError?.(message);
      return false;
    }
  }

  /** Replaces any cached clip for `id` with fresh bytes and a new object URL. */
  private hydrate(id: string, data: ArrayBuffer, voice: string): void {
    this.evict(id);
    this.cache.set(id, { url: URL.createObjectURL(new Blob([data], { type: 'audio/wav' })), data, voice });
  }

  /**
   * Plays the cached clip for `id`, pausing any other active clip first. A
   * finished clip restarts from the beginning; a paused one resumes in place.
   */
  private async start(id: string): Promise<void> {
    const cached = this.cache.get(id);
    if (!cached) return;

    if (this.activeId && this.activeId !== id) this.pauseActive();

    let audio = this.audios.get(id);
    if (!audio) {
      audio = new Audio(cached.url);
      audio.addEventListener('ended', () => this.handleEnded(id));
      audio.addEventListener('error', () => {
        this.setState(id, { status: 'idle', error: 'Audio playback failed.' });
        if (this.activeId === id) this.activeId = null;
        void this.drain();
      });
      this.audios.set(id, audio);
    }

    if (audio.ended) audio.currentTime = 0;

    try {
      await audio.play();
      this.activeId = id;
      this.setState(id, { status: 'playing' });
    } catch (err) {
      this.setState(id, { status: 'idle', error: err instanceof Error ? err.message : 'Playback failed.' });
    }
  }

  private pauseActive(): void {
    if (!this.activeId) return;
    this.audios.get(this.activeId)?.pause();
    this.setState(this.activeId, { status: 'paused' });
    this.activeId = null;
  }

  private handleEnded(id: string): void {
    this.setState(id, { status: 'idle' });
    if (this.activeId === id) this.activeId = null;
    void this.drain();
  }

  private evict(id: string): void {
    const cached = this.cache.get(id);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      this.cache.delete(id);
    }
    this.audios.delete(id);
  }
}

export const ttsPlayback = new TtsController();
