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
import { prepareForTTS } from '../tts/text-prep.js';
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

    const abortController = new AbortController();
    this.activeAbortControllers.set(sessionId, abortController);

    try {
      // 1. Speculative acknowledgment
      const ackAudio = this.speculativeAck.check(utterance, confidence, session);
      if (ackAudio) {
        logger.log('orchestrator: speculative ack fired');
        this.emit('audio', {
          sessionId,
          audio: ackAudio,
          sentenceIndex: -1, // Special index for ack
          priority: SpeechPriority.RESPONSE,
          isFinal: true,
        } satisfies AudioEmission);
      }

      // 2. Build messages with session context
      const messages = this.sessionManager.buildMessages(sessionId, utterance);

      // 3. Stream LLM tokens through delivery router + sentence detection + parallel TTS
      const sentenceDetector = new SentenceDetector();
      const ttsPromises: Promise<void>[] = [];
      let sentenceIndex = 0;
      let fullResponse = '';
      let displayBuffer = '';
      let actionBuffer = '';
      const artifacts: Array<{ content: string; meta: ArtifactMeta }> = [];

      // Delivery router splits [VOICE]/[DISPLAY]/[ACTION]/[ARTIFACT] in real-time
      const deliveryRouter = new DeliveryRouter({
        onVoice: (text) => {
          const sentence = sentenceDetector.addToken(text);
          if (sentence) {
            const finalSentence = hasScreen ? sentence : rewriteForVoiceOnly(sentence);
            const idx = sentenceIndex++;
            ttsPromises.push(this.synthesizeAndEmit(sessionId, finalSentence, idx, abortController.signal));
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

      // 4. Flush delivery router and sentence detector
      if (!abortController.signal.aborted) {
        deliveryRouter.flush();
        const remaining = sentenceDetector.flush();
        if (remaining) {
          const finalRemaining = hasScreen ? remaining : rewriteForVoiceOnly(remaining);
          ttsPromises.push(this.synthesizeAndEmit(sessionId, finalRemaining, sentenceIndex, abortController.signal));
        }
      }

      // 5. Wait for all TTS to complete
      await Promise.allSettled(ttsPromises);

      // 6. Emit display/action/artifact content
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

      // 7. Record the full response
      if (!abortController.signal.aborted && fullResponse) {
        this.sessionManager.addJarvisExchange(sessionId, fullResponse);
        this.fullResponses.set(sessionId, fullResponse);
      }

      // 8. Transition to follow-up state
      if (!abortController.signal.aborted) {
        this.emit('speaking_done', { sessionId });
        this.sessionManager.setState(sessionId, 'followup');
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
            this.emit('audio', {
              sessionId,
              audio: errorAudio,
              sentenceIndex: 0,
              priority: SpeechPriority.RESPONSE,
              isFinal: true,
            } satisfies AudioEmission);
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

  // --- private ---

  private async synthesizeAndEmit(
    sessionId: string,
    text: string,
    index: number,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;

    // Prepare text for TTS
    const sentences = prepareForTTS(text);
    const prepared = sentences.join(' ');
    if (!prepared) return;

    // Check phrase cache first
    const cached = this.phraseCache.get(prepared);
    if (cached) {
      if (!signal.aborted) {
        this.emit('audio', {
          sessionId,
          audio: cached,
          sentenceIndex: index,
          priority: SpeechPriority.RESPONSE,
          isFinal: true,
        } satisfies AudioEmission);
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
            this.emit('audio', {
              sessionId,
              audio: chunk,
              sentenceIndex: index,
              priority: SpeechPriority.RESPONSE,
              isFinal: false,
            } satisfies AudioEmission);
          }
        },
      );
      // Emit a final marker for this sentence
      if (!signal.aborted) {
        this.emit('audio', {
          sessionId,
          audio: Buffer.alloc(0),
          sentenceIndex: index,
          priority: SpeechPriority.RESPONSE,
          isFinal: true,
        } satisfies AudioEmission);
      }
    } catch (err) {
      if (!signal.aborted) {
        logger.error(`orchestrator: TTS failed for sentence ${index}: ${err}`);
      }
    }
  }
}
