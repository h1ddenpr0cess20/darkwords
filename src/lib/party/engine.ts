/**
 * Party-mode orchestration engine.
 *
 * Drives an autonomous, multi-character turn loop on top of the same streaming
 * pipeline as ordinary chat. Every character shares the model selected in
 * Settings → Model; each turn streams into its own message bubble labelled with
 * the speaker's name. The user can interject at any time without pausing;
 * pause / resume / stop are separate controls.
 *
 * Ported from Wordmark's `partyEngine.ts`. The engine owns the loop only — it
 * talks to the app through the injected {@link PartyHost} so it stays free of
 * the store's import graph.
 */

import {
  DEFAULT_USER_NAME,
  appendPartyDocumentContext,
  buildCharacterSystemPrompt,
  buildDecisionPrompt,
  buildFirstTurnPrompt,
  buildTurnPrompt,
  findAddressedParticipant,
  type PartyToolInfo,
} from './prompts';
import type { PartyCharacter, PartyConfig, PartyDocument, PartyScenario, PartyStatus } from './types';
import { defaultScenario } from './types';

const TURN_DELAY_MS = 1500;
const PAUSE_POLL_MS = 150;
const HISTORY_BUFFER_LIMIT = 12;

/** A transcript line as the engine sees it. */
export interface TranscriptLine {
  /** Speaker name — a character's name, or the observer's name for the user. */
  name: string;
  text: string;
}

/**
 * Everything the engine needs from the app. Implemented by the store so the
 * engine never imports it (which would be a cycle).
 */
export interface PartyHost {
  /** Creates an empty streaming assistant bubble for a speaker; returns its id. */
  createSpeakerMessage(character: PartyCharacter): string;
  /**
   * Streams one character turn into `messageId`. Resolves with whatever text was
   * produced — including a partial, if the turn was aborted mid-stream.
   */
  streamTurn(opts: {
    messageId: string;
    character: PartyCharacter;
    systemPrompt: string;
    prompt: string;
    signal: AbortSignal;
  }): Promise<string>;
  /** Marks a bubble as finished and re-parses its text into blocks. */
  finalizeMessage(messageId: string): void;
  /** Discards a bubble that produced nothing. */
  discardMessage(messageId: string): void;
  /** Renders + records the observer's interjection bubble. */
  recordUserBubble(text: string): void;
  /** The existing conversation, used to seed the transcript when resuming. */
  readTranscript(): TranscriptLine[];
  /** One-shot, non-streaming completion — used to pick the next speaker. */
  complete(prompt: string, signal: AbortSignal): Promise<string>;
  /** Pushes engine status + active config into the store, for the control bar. */
  setStatus(status: PartyStatus, config: PartyConfig | null): void;
  onError(message: string): void;
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class PartyEngine {
  private host: PartyHost | null = null;

  private running = false;
  private paused = false;
  private pauseRequested = false;
  private abort = false;
  private skipDelayNextTurn = false;

  private history: string[] = [];
  private pendingInterjections: string[] = [];
  private controller: AbortController | null = null;

  private characters: PartyCharacter[] = [];
  private scenario: PartyScenario = defaultScenario();
  private userName = DEFAULT_USER_NAME;
  private documents: PartyDocument[] = [];
  private config: PartyConfig | null = null;

  /** Wires the engine to the app. Called once, from the store. */
  setHost(host: PartyHost): void {
    this.host = host;
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** The cast/scenario currently loaded, so a stopped party can be resumed. */
  activeConfig(): PartyConfig | null {
    return this.config;
  }

  /** Starts (or restarts) the turn loop for a cast. */
  async start(config: PartyConfig): Promise<void> {
    const host = this.host;
    if (!host) return;

    // Restarting: tear the previous loop down and wait for it to unwind.
    if (this.running) {
      this.abort = true;
      this.paused = false;
      this.controller?.abort();
    }
    while (this.running) {
      await waitFor(PAUSE_POLL_MS);
    }

    if (config.characters.length < 2) {
      host.onError('Add at least two characters before starting a party.');
      return;
    }

    this.characters = config.characters;
    this.scenario = config.scenario;
    this.userName = config.userName?.trim() || DEFAULT_USER_NAME;
    this.documents = config.documents ? [...config.documents] : [];
    this.config = { ...config, userName: this.userName, documents: this.documents };

    this.abort = false;
    this.paused = false;
    this.pauseRequested = false;
    this.skipDelayNextTurn = false;
    this.pendingInterjections = [];
    this.history = this.seedHistory();
    this.running = true;

    const isFreshStart = this.history.length === 0;
    this.publish();

    try {
      let currentSpeaker = this.pickInitialSpeaker();
      await this.emitTurn(currentSpeaker, isFreshStart);

      while (!this.abort) {
        if (this.skipDelayNextTurn) {
          this.skipDelayNextTurn = false;
        } else {
          await this.delayBetweenTurns();
        }

        await this.waitIfPaused();
        if (this.abort) break;

        this.consumePendingInterjections();

        // Re-pick if an interjection lands while we're deciding — it may change
        // who should speak next (e.g. the observer named someone).
        let nextSpeaker: PartyCharacter | null = null;
        while (!this.abort && !nextSpeaker) {
          nextSpeaker = await this.chooseNextSpeaker(currentSpeaker);
          await this.waitIfPaused();
          if (this.abort) break;
          if (this.consumePendingInterjections()) nextSpeaker = null;
        }

        if (this.abort || !nextSpeaker) break;

        await this.waitIfPaused();
        if (this.abort) break;
        if (this.consumePendingInterjections()) continue;

        await this.emitTurn(nextSpeaker, false);
        currentSpeaker = nextSpeaker;
      }
    } catch (err) {
      host.onError(`Party error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
      this.paused = false;
      this.pauseRequested = false;
      this.skipDelayNextTurn = false;
      this.pendingInterjections = [];
      this.controller = null;
      this.publish();
    }
  }

  /** Requests a pause at the next safe checkpoint — never mid-stream. */
  pause(): void {
    if (!this.running || this.paused || this.pauseRequested) return;
    this.pauseRequested = true;
    this.publish();
  }

  /** Resumes a paused loop, also cancelling a pause that hasn't taken hold yet. */
  resume(): void {
    if (!this.running || (!this.paused && !this.pauseRequested)) return;
    this.paused = false;
    this.pauseRequested = false;
    this.publish();
  }

  /** Stops the loop and aborts any in-flight request. */
  stop(): void {
    if (!this.running) {
      this.publish();
      return;
    }
    this.abort = true;
    this.paused = false;
    this.pauseRequested = false;
    this.pendingInterjections = [];
    this.skipDelayNextTurn = false;
    this.controller?.abort();
    this.publish();
  }

  /**
   * Queues an observer interjection. The bubble is recorded immediately, then
   * the loop is made to run so the message actually gets a reply: a live loop
   * weaves it in at the next checkpoint, a paused loop resumes, and a stopped
   * party restarts with the message already in the transcript.
   */
  queueInterjection(message: string): void {
    const trimmed = message.trim();
    if (!trimmed || !this.config) return;

    this.host?.recordUserBubble(trimmed);

    if (this.running) {
      this.pendingInterjections.push(trimmed);
      this.skipDelayNextTurn = true;
      if (this.paused) this.resume();
      return;
    }
    void this.start(this.config);
  }

  /** Adds documents every character can see. */
  addDocuments(documents: PartyDocument[]): void {
    if (!documents.length) return;
    this.documents.push(...documents);
    if (this.config) this.config.documents = this.documents;
    this.publish();
  }

  /** Clears the party entirely (leaving party mode). */
  reset(): void {
    this.stop();
    this.config = null;
    this.characters = [];
    this.documents = [];
    this.history = [];
    this.publish();
  }

  // --- internals ---

  private publish(): void {
    let status: PartyStatus = 'off';
    if (this.config) {
      status = this.running ? (this.paused ? 'paused' : 'running') : 'stopped';
    }
    this.host?.setStatus(status, this.config);
  }

  /** Rebuilds the rolling prompt buffer from the conversation already on screen. */
  private seedHistory(): string[] {
    const lines = (this.host?.readTranscript() ?? [])
      .filter((l) => l.text.trim())
      .map((l) => `${l.name}: ${l.text.trim()}`);
    return lines.slice(-HISTORY_BUFFER_LIMIT);
  }

  /** Emits one character turn, streaming into its own bubble. */
  private async emitTurn(speaker: PartyCharacter, isFirst: boolean): Promise<void> {
    const host = this.host;
    if (!host) return;

    const messageId = host.createSpeakerMessage(speaker);

    const prompt = isFirst
      ? buildFirstTurnPrompt(speaker, this.characters, this.scenario)
      : buildTurnPrompt(this.scenario, this.history, this.userName);

    const systemPrompt = appendPartyDocumentContext(
      buildCharacterSystemPrompt(speaker, this.describeTools(speaker)),
      this.documents,
    );

    this.controller = new AbortController();

    let text = '';
    try {
      text = await host.streamTurn({
        messageId,
        character: speaker,
        systemPrompt,
        prompt,
        signal: this.controller.signal,
      });
    } catch (err) {
      const aborted = this.abort || (err instanceof DOMException && err.name === 'AbortError');
      if (!aborted) throw err;
    }

    // A turn that produced tokens is kept even if it was aborted — those tokens
    // are already paid for.
    if (text.trim()) {
      host.finalizeMessage(messageId);
      this.recordHistoryEntry(speaker.name, text);
    } else {
      host.discardMessage(messageId);
    }
  }

  /** Describes a character's tools so its system prompt can mention them. */
  private describeTools(speaker: PartyCharacter): PartyToolInfo[] {
    const known: Record<string, { displayName: string; description: string }> = {
      web: { displayName: 'Web search', description: 'look up current information' },
      code: { displayName: 'Code interpreter', description: 'run code to compute or analyse' },
      image: { displayName: 'Image generation', description: 'create an image from a description' },
      files: { displayName: 'File attachments', description: 'read shared documents' },
    };
    return speaker.allowedTools
      .filter((key) => key in known)
      .map((key) => ({ key, ...known[key] }));
  }

  /**
   * When the latest transcript line is an interjection naming exactly one
   * character, that character answers next.
   */
  private observerAddressedSpeaker(): PartyCharacter | null {
    const latest = this.history[this.history.length - 1] ?? '';
    const separator = latest.indexOf(':');
    if (separator < 0) return null;
    if (latest.slice(0, separator).trim() !== this.userName.trim()) return null;

    const addressed = findAddressedParticipant(
      latest.slice(separator + 1),
      this.characters.map((c) => c.name),
    );
    return addressed ? (this.characters.find((c) => c.name === addressed) ?? null) : null;
  }

  /**
   * Picks the next speaker: an addressed character takes the turn directly; two
   * characters simply alternate; three or more ask the model to decide.
   */
  private async chooseNextSpeaker(currentSpeaker: PartyCharacter): Promise<PartyCharacter> {
    const addressed = this.observerAddressedSpeaker();
    if (addressed) return addressed;

    if (this.characters.length === 2) {
      return this.characters.find((c) => c.id !== currentSpeaker.id) ?? currentSpeaker;
    }

    try {
      const raw = await this.host!.complete(
        buildDecisionPrompt(this.scenario, this.characters, this.history),
        this.controller?.signal ?? new AbortController().signal,
      );
      const candidate = raw.split('|')[0]?.trim().toLowerCase();
      const match = this.characters.find((c) => c.name.toLowerCase() === candidate);
      if (match) return match;
    } catch {
      // Fall through to a random pick — a failed decision must not stall the loop.
    }

    return this.pickRandomSpeaker(currentSpeaker.id);
  }

  /**
   * Paces the conversation, polling so a pause/stop/interjection during the gap
   * takes effect promptly instead of waiting the delay out.
   */
  private async delayBetweenTurns(): Promise<void> {
    let remaining = TURN_DELAY_MS;
    while (remaining > 0 && !this.abort && !this.pauseRequested && !this.paused) {
      if (this.skipDelayNextTurn) {
        this.skipDelayNextTurn = false;
        return;
      }
      const step = Math.min(PAUSE_POLL_MS, remaining);
      await waitFor(step);
      remaining -= step;
    }
  }

  private async waitIfPaused(): Promise<void> {
    if (this.pauseRequested && !this.paused) {
      this.paused = true;
      this.pauseRequested = false;
      this.publish();
    }
    while (this.paused && !this.abort) {
      await waitFor(PAUSE_POLL_MS);
    }
  }

  private consumePendingInterjections(): boolean {
    if (!this.pendingInterjections.length) return false;
    for (const message of this.pendingInterjections) {
      this.recordHistoryEntry(this.userName, message);
    }
    this.pendingInterjections = [];
    return true;
  }

  private recordHistoryEntry(name: string, content: string): void {
    const trimmed = content.trim();
    if (!trimmed) return;
    this.history.push(`${name.trim() || 'Speaker'}: ${trimmed}`);
    if (this.history.length > HISTORY_BUFFER_LIMIT) {
      this.history.splice(0, this.history.length - HISTORY_BUFFER_LIMIT);
    }
  }

  private pickInitialSpeaker(): PartyCharacter {
    return this.characters[Math.floor(Math.random() * this.characters.length)];
  }

  private pickRandomSpeaker(excludeId: string): PartyCharacter {
    const options = this.characters.filter((c) => c.id !== excludeId);
    if (!options.length) return this.characters[0];
    return options[Math.floor(Math.random() * options.length)];
  }
}

/** Shared party engine singleton. */
export const partyEngine = new PartyEngine();
