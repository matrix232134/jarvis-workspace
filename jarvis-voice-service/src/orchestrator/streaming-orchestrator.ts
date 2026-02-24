/**
 * Streaming Orchestrator — the core of the voice pipeline.
 *
 * Coordinates:
 * 1. Receives user utterance from STT
 * 2. Checks speculative acknowledgment for instant cached response
 * 3. Streams LLM tokens via OpenClaw
 * 4. Detects sentence boundaries in the token stream
 * 5. Dispatches sentences to Cartesia TTS in parallel
 * 6. Emits ordered audio chunks for downstream playback
 *
 * The key insight: sentence N+1's TTS starts while sentence N is still playing.
 * Audio chunks are emitted with sentence indices so the player can order them.
 */

import { EventEmitter } from 'node:events';
import { SentenceDetector } from './sentence-detector.js';
import { DeliveryRouter, type ArtifactMeta } from './delivery-router.js';
import { rewriteForVoiceOnly } from './voice-rewriter.js';
import { SessionManager } from './session-manager.js';
import { SpeculativeAck } from './speculative-ack.js';
import { CartesiaClient } from '../tts/cartesia-client.js';
import { PhraseCache } from '../tts/phrase-cache.js';
import { prepareForTTS, stripMarkdown, expandAbbreviations } from '../tts/text-prep.js';
import { SpeechPriority } from '../types.js';
import type { OpenClawStreamClient } from '../openclaw/openclaw-stream-client.js';
import type { SpeechPriorityQueue } from '../tts/priority-queue.js';
import * as logger from '../logger.js';

export interface AudioEmission {
  sessionId: string;
  audio: Buffer;
  sentenceIndex: number;
  priority: SpeechPriority;
  isFinal: boolean; // true if this is the last chunk for this sentence
}

export class StreamingOrchestrator extends EventEmitter {
  private sessionManager: SessionManager;
  private speculativeAck: SpeculativeAck;
  private cartesia: CartesiaClient;
  private phraseCache: PhraseCache;
  private openclawClient: OpenClawStreamClient;
  private priorityQueue: SpeechPriorityQueue;

  // Active orchestration state per session
  private activeAbortControllers = new Map<string, AbortController>();
  private fullResponses = new Map<string, string>(); // sessionId → accumulated LLM text

  // Ordered audio emission — ensures sentence N plays fully before sentence N+1
  private playbackStates = new Map<string, {
    currentSentence: number;
    buffers: Map<number, Buffer[]>;
    finalSeen: Set<number>;
  }>();

  constructor(opts: {
    sessionManager: SessionManager;
    speculativeAck: SpeculativeAck;
    cartesia: CartesiaClient;
    phraseCache: PhraseCache;
    openclawClient: OpenClawStreamClient;
    priorityQueue: SpeechPriorityQueue;
  }) {
    super();
    this.sessionManager = opts.sessionManager;
    this.speculativeAck = opts.speculativeAck;
    this.cartesia = opts.cartesia;
    this.phraseCache = opts.phraseCache;
    this.openclawClient = opts.openclawClient;
    this.priorityQueue = opts.priorityQueue;
  }

  /**
   * Process a complete user utterance through the full pipeline.
   * This is the main entry point — called when STT finalizes a user utterance.
   */
  async processUtterance(
    sessionId: string,
    utterance: string,
    confidence: number,
    hasScreen = true,
  ): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn(`orchestrator: no session ${sessionId}`);
      return;
    }

    logger.log(`orchestrator: processing "${utterance}" (confidence: ${confidence.toFixed(2)})`);

    // Record user exchange
    this.sessionManager.addUserExchange(sessionId, utterance);
    this.sessionManager.setState(sessionId, 'processing');

    // Abort any previous orchestration for this session
    this.cancelSession(sessionId);

    // Fresh playback state for this utterance
    this.playbackStates.delete(sessionId);

    const abortController = new AbortController();
    this.activeAbortControllers.set(sessionId, abortController);

    try {
      // 1. Speculative acknowledgment
      const ackAudio = this.speculativeAck.check(utterance, confidence, session);
      if (ackAudio) {
        logger.log('orchestrator: speculative ack fired');
        this.emitAudioOrdered({
          sessionId,
          audio: ackAudio,
          sentenceIndex: -1, // Special index for ack
          priority: SpeechPriority.RESPONSE,
          isFinal: true,
        });
      }

      // 2. Build messages with session context
      const messages = this.sessionManager.buildMessages(sessionId, utterance, hasScreen);

      // 3. Stream LLM tokens through delivery router + sentence detection + parallel TTS
      const sentenceDetector = new SentenceDetector();
      let sentenceIndex = 0;
      let totalSentences = 0;
      let completedSentences = 0;
      let allSentencesQueued = false;
      let speakingDoneFired = false;
      let fullResponse = '';
      let displayBuffer = '';
      let actionBuffer = '';
      const artifacts: Array<{ content: string; meta: ArtifactMeta }> = [];

      // Fire speaking_done when the last TTS sentence completes (not when all promises resolve)
      const onSentenceAudioDone = () => {
        completedSentences++;
        if (allSentencesQueued && completedSentences >= totalSentences && !speakingDoneFired) {
          speakingDoneFired = true;
          if (!abortController.signal.aborted) {
            this.emit('speaking_done', { sessionId });
            this.sessionManager.setState(sessionId, 'followup');
          }
        }
      };

      const enqueueSentence = (text: string) => {
        const idx = sentenceIndex++;
        totalSentences++;
        this.synthesizeAndEmit(sessionId, text, idx, abortController.signal)
          .then(onSentenceAudioDone)
          .catch(onSentenceAudioDone);
      };

      // Delayed processing ack — if no voice audio is queued within 2s,
      // play a cached filler so the user knows JARVIS is working on it.
      // This covers long-generation requests (artifacts, complex responses).
      const PROCESSING_ACK_PHRASES = [
        'One moment, sir.',
        'Working on it.',
        'On it, sir.',
      ];
      let processingAckFired = false;
      const processingAckTimer = !ackAudio ? setTimeout(() => {
        if (abortController.signal.aborted || totalSentences > 0) return;
        const phrase = PROCESSING_ACK_PHRASES[Math.floor(Math.random() * PROCESSING_ACK_PHRASES.length)];
        const audio = this.phraseCache.get(phrase);
        if (audio) {
          processingAckFired = true;
          logger.log(`orchestrator: processing ack → "${phrase}"`);
          this.emitAudioOrdered({
            sessionId,
            audio,
            sentenceIndex: -1,
            priority: SpeechPriority.RESPONSE,
            isFinal: true,
          });
        }
      }, 2000) : null;

      // Delivery router splits [VOICE]/[DISPLAY]/[ACTION]/[ARTIFACT] in real-time
      const deliveryRouter = new DeliveryRouter({
        onVoice: (text) => {
          const sentence = sentenceDetector.addToken(text);
          if (sentence) {
            if (processingAckTimer) clearTimeout(processingAckTimer);
            const finalSentence = hasScreen ? sentence : rewriteForVoiceOnly(sentence);
            enqueueSentence(finalSentence);
          }
        },
        onDisplay: (text) => { displayBuffer += text; },
        onAction: (text) => { actionBuffer += text; },
        onArtifact: (content, meta) => { artifacts.push({ content, meta }); },
      });

      this.sessionManager.setState(sessionId, 'speaking');

      for await (const token of this.openclawClient.streamChat(messages, abortController.signal)) {
        if (abortController.signal.aborted) break;
        fullResponse += token;
        deliveryRouter.addToken(token);
      }

      // Clean up the ack timer if it hasn't fired
      if (processingAckTimer) clearTimeout(processingAckTimer);

      // 4. Flush delivery router and sentence detector
      if (!abortController.signal.aborted) {
        deliveryRouter.flush();
        const remaining = sentenceDetector.flush();
        if (remaining) {
          const finalRemaining = hasScreen ? remaining : rewriteForVoiceOnly(remaining);
          enqueueSentence(finalRemaining);
        }
      }

      // Mark all sentences as queued so the completion tracker can fire
      allSentencesQueued = true;

      // If no sentences were produced (e.g. pure display/artifact response), fire immediately
      if (totalSentences === 0 && !speakingDoneFired) {
        speakingDoneFired = true;
        if (!abortController.signal.aborted) {
          this.emit('speaking_done', { sessionId });
          this.sessionManager.setState(sessionId, 'followup');
        }
      }

      // 5. Emit display/action/artifact content immediately (don't wait for TTS)
      if (!abortController.signal.aborted && displayBuffer.trim()) {
        this.emit('display', { sessionId, content: displayBuffer.trim() });
      }
      if (!abortController.signal.aborted && actionBuffer.trim()) {
        this.emit('action', { sessionId, content: actionBuffer.trim() });
      }
      for (const artifact of artifacts) {
        if (!abortController.signal.aborted) {
          this.emit('artifact', { sessionId, content: artifact.content, meta: artifact.meta });
        }
      }

      // 6. Record the full response
      if (!abortController.signal.aborted && fullResponse) {
        this.sessionManager.addJarvisExchange(sessionId, fullResponse);
        this.fullResponses.set(sessionId, fullResponse);
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        logger.log(`orchestrator: session ${sessionId} was cancelled`);
      } else {
        logger.error(`orchestrator: error processing utterance: ${err}`);
        // Try to speak the error
        try {
          const errorAudio = this.phraseCache.get('Not certain about that, sir.');
          if (errorAudio) {
            this.emitAudioOrdered({
              sessionId,
              audio: errorAudio,
              sentenceIndex: 0,
              priority: SpeechPriority.RESPONSE,
              isFinal: true,
            });
          }
        } catch { /* ignore */ }
        this.sessionManager.setState(sessionId, 'followup');
      }
    } finally {
      this.activeAbortControllers.delete(sessionId);
    }
  }

  /** Get the full LLM response text for a session */
  getFullResponse(sessionId: string): string | null {
    return this.fullResponses.get(sessionId) ?? null;
  }

  /** Cancel an active orchestration (for barge-in) */
  cancelSession(sessionId: string): void {
    const controller = this.activeAbortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(sessionId);
    }
    this.playbackStates.delete(sessionId);
    this.priorityQueue.clearSession(sessionId);
  }

  /** Handle barge-in: cancel current, record interrupted text, prepare for new input */
  handleBargeIn(sessionId: string, keyword: string): void {
    logger.log(`orchestrator: barge-in "${keyword}" on session ${sessionId}`);

    const fullResponse = this.fullResponses.get(sessionId) ?? '';
    this.cancelSession(sessionId);

    // Record what JARVIS was saying when interrupted
    if (fullResponse) {
      this.sessionManager.addJarvisExchange(sessionId, fullResponse, true, fullResponse);
    }

    this.fullResponses.delete(sessionId);
    this.sessionManager.setState(sessionId, 'listening');
    this.emit('barge_in', { sessionId, keyword });
  }

  // --- Ordered audio emission ---

  /**
   * Emit audio in sentence order. TTS runs in parallel for low latency,
   * but this method ensures sentence N's chunks are fully emitted before
   * sentence N+1 starts playing. Without this, interleaved chunks from
   * parallel TTS sound garbled/choppy.
   */
  private emitAudioOrdered(emission: AudioEmission): void {
    // Speculative acks (index < 0) always emit immediately
    if (emission.sentenceIndex < 0) {
      this.emit('audio', emission);
      return;
    }

    let state = this.playbackStates.get(emission.sessionId);
    if (!state) {
      state = { currentSentence: 0, buffers: new Map(), finalSeen: new Set() };
      this.playbackStates.set(emission.sessionId, state);
    }

    const idx = emission.sentenceIndex;

    if (idx === state.currentSentence) {
      // Current sentence — emit chunks immediately for streaming playback
      if (emission.audio.length > 0) {
        this.emit('audio', emission);
      }
      if (emission.isFinal) {
        state.finalSeen.add(idx);
        this.advancePlayback(emission.sessionId, state);
      }
    } else if (idx > state.currentSentence) {
      // Future sentence — buffer until current sentence finishes
      if (!state.buffers.has(idx)) {
        state.buffers.set(idx, []);
      }
      if (emission.audio.length > 0) {
        state.buffers.get(idx)!.push(emission.audio);
      }
      if (emission.isFinal) {
        state.finalSeen.add(idx);
      }
    }
    // idx < currentSentence: stale chunk from cancelled sentence, ignore
  }

  /** Advance to the next sentence and flush any buffered chunks for it. */
  private advancePlayback(sessionId: string, state: {
    currentSentence: number;
    buffers: Map<number, Buffer[]>;
    finalSeen: Set<number>;
  }): void {
    state.currentSentence++;

    const buffered = state.buffers.get(state.currentSentence);
    if (buffered) {
      // Flush all buffered chunks for this sentence
      for (const chunk of buffered) {
        this.emit('audio', {
          sessionId,
          audio: chunk,
          sentenceIndex: state.currentSentence,
          priority: SpeechPriority.RESPONSE,
          isFinal: false,
        } satisfies AudioEmission);
      }
      state.buffers.delete(state.currentSentence);

      // If this sentence already completed while buffered, advance again
      if (state.finalSeen.has(state.currentSentence)) {
        this.advancePlayback(sessionId, state);
      }
    }
  }

  // --- private ---

  private async synthesizeAndEmit(
    sessionId: string,
    text: string,
    index: number,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;

    // Prepare text for TTS — sentence is already split by SentenceDetector,
    // so skip redundant splitSentences; just clean markdown + expand abbreviations
    const prepared = expandAbbreviations(stripMarkdown(text)).trim();
    if (!prepared) return;

    // Check phrase cache first
    const cached = this.phraseCache.get(prepared);
    if (cached) {
      if (!signal.aborted) {
        this.emitAudioOrdered({
          sessionId,
          audio: cached,
          sentenceIndex: index,
          priority: SpeechPriority.RESPONSE,
          isFinal: true,
        });
      }
      return;
    }

    // Synthesize via Cartesia with streaming chunks
    const contextId = `${sessionId}-s${index}`;
    try {
      await this.cartesia.synthesize(
        prepared,
        contextId,
        (chunk) => {
          if (!signal.aborted) {
            this.emitAudioOrdered({
              sessionId,
              audio: chunk,
              sentenceIndex: index,
              priority: SpeechPriority.RESPONSE,
              isFinal: false,
            });
          }
        },
      );
      // Emit a final marker for this sentence
      if (!signal.aborted) {
        this.emitAudioOrdered({
          sessionId,
          audio: Buffer.alloc(0),
          sentenceIndex: index,
          priority: SpeechPriority.RESPONSE,
          isFinal: true,
        });
      }
    } catch (err) {
      if (!signal.aborted) {
        logger.error(`orchestrator: TTS failed for sentence ${index}: ${err}`);
      }
    }
  }
}
