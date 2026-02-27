/**
 * Voice module — the device-side voice pipeline.
 *
 * State machine: IDLE → WAKE_DETECTED → STREAMING → PLAYING → IDLE
 *
 * - Continuously runs wake word detection on mic audio
 * - On "JARVIS" wake word: starts voice session, streams mic to bridge
 * - On audio from bridge: plays TTS through speakers
 * - On "stop"/"wait" during playback: barge-in
 * - On session end: returns to IDLE
 */

import { randomUUID } from 'node:crypto';
import { MicCapture } from './mic-capture.js';
import { AudioPlayer } from './audio-player.js';
import { WakeWordDetector, type WakeWordConfig } from './wake-word.js';
import { Feedback } from './feedback.js';
import { onBinaryFrame, onJsonFrame, sendBinary, sendFrame } from '../device-client.js';
import type { BridgeFrame } from '../types.js';
import * as logger from '../logger.js';

const AUDIO_HEADER_LENGTH = 37;
const SESSION_ID_LENGTH = 36;

type VoiceState = 'idle' | 'wake_detected' | 'streaming' | 'playing';

export interface VoiceModuleConfig {
  micDeviceName?: string;
  wakeWordThreshold?: number;
}

export class VoiceModule {
  private state: VoiceState = 'idle';
  private sessionId: string | null = null;
  private mic: MicCapture;
  private player: AudioPlayer;
  private wakeWord: WakeWordDetector;
  private feedback: Feedback;
  private config: VoiceModuleConfig;
  private followUpTimer: ReturnType<typeof setTimeout> | null = null;
  private processingWakeWord = false;

  constructor(config: VoiceModuleConfig) {
    this.config = config;
    this.mic = new MicCapture();
    this.player = new AudioPlayer();
    this.wakeWord = new WakeWordDetector();
    this.feedback = new Feedback();
  }

  async start(): Promise<void> {
    logger.log('voice-module: starting...');

    // Initialize wake word detector (OpenWakeWord — no API key needed)
    await this.wakeWord.init({
      threshold: this.config.wakeWordThreshold,
    });

    // Register binary frame handler for incoming TTS audio
    onBinaryFrame((data: Buffer) => {
      this.handleDownstreamAudio(data);
    });

    // Register JSON frame handler for voice control frames
    onJsonFrame((frame: BridgeFrame) => {
      this.handleControlFrame(frame);
    });

    // Start continuous mic capture for wake word detection
    this.mic.start((frame: Buffer) => {
      this.processAudioFrame(frame);
    }, this.wakeWord.frameLength, this.config.micDeviceName);

    logger.log(`voice-module: ready (wakeWord=${this.wakeWord.initialized ? 'active' : 'disabled'})`);
  }

  stop(): void {
    this.mic.stop();
    this.player.stop();
    this.wakeWord.release();
    this.clearFollowUpTimer();
    this.state = 'idle';
    this.sessionId = null;
    logger.log('voice-module: stopped');
  }

  /** Process each audio frame from the microphone */
  private async processAudioFrame(frame: Buffer): Promise<void> {
    // Always send upstream if streaming (don't wait for wake word)
    if (this.state === 'streaming' && this.sessionId) {
      this.sendAudioUpstream(frame);
    }

    // Run wake word detection (skip if previous frame still processing)
    if (this.processingWakeWord) return;
    this.processingWakeWord = true;
    try {
      const keywordIndex = await this.wakeWord.process(frame);
      if (keywordIndex >= 0) {
        this.handleKeyword(keywordIndex);
      }
    } catch {
      // Don't crash on wake word errors
    } finally {
      this.processingWakeWord = false;
    }
  }

  private handleKeyword(keywordIndex: number): void {
    if (keywordIndex === 0 /* JARVIS */) {
      if (this.state === 'idle') {
        // New session
        this.startSession();
      } else if (this.state === 'playing') {
        // JARVIS as interrupt during playback
        this.handleBargeIn('jarvis');
      }
      // If already streaming/processing, ignore
    } else if (keywordIndex >= 1 /* stop, wait, actually */) {
      if (this.state === 'playing') {
        const keywords = ['jarvis', 'stop', 'wait', 'actually'];
        this.handleBargeIn(keywords[keywordIndex] ?? 'stop');
      }
    }
  }

  private startSession(): void {
    this.clearFollowUpTimer();
    this.sessionId = randomUUID();
    this.state = 'streaming';

    logger.log(`voice-module: session started ${this.sessionId}`);
    this.feedback.playChime('listening');

    // Notify voice service via bridge
    sendFrame({
      type: 'voice.session_start',
      id: randomUUID(),
      payload: { sessionId: this.sessionId },
    });
  }

  private handleBargeIn(keyword: string): void {
    if (!this.sessionId) return;

    logger.log(`voice-module: barge-in "${keyword}"`);

    // Stop playback immediately
    this.player.stop();

    // Notify voice service
    sendFrame({
      type: 'voice.barge_in',
      id: randomUUID(),
      payload: { sessionId: this.sessionId, keyword },
    });

    // Switch back to streaming (mic was already running)
    this.state = 'streaming';
  }

  private sendAudioUpstream(frame: Buffer): void {
    if (!this.sessionId) return;

    // Build binary frame: [36-byte sessionId][1-byte direction=0x00][PCM audio]
    const header = Buffer.alloc(AUDIO_HEADER_LENGTH);
    header.write(this.sessionId, 0, SESSION_ID_LENGTH, 'ascii');
    header[SESSION_ID_LENGTH] = 0x00; // upstream
    const packet = Buffer.concat([header, frame]);
    sendBinary(packet);
  }

  /** Handle incoming binary audio from voice service (TTS playback) */
  private handleDownstreamAudio(data: Buffer): void {
    if (data.length < AUDIO_HEADER_LENGTH) return;

    const sessionId = data.subarray(0, SESSION_ID_LENGTH).toString('ascii');
    if (sessionId !== this.sessionId) return;

    const audio = data.subarray(AUDIO_HEADER_LENGTH);
    if (audio.length === 0) return;

    // Start player if not already playing
    if (this.state !== 'playing') {
      this.state = 'playing';
      this.player.start(24000); // Cartesia outputs at 24kHz
    }

    this.player.write(audio);
  }

  /** Handle JSON control frames from voice service */
  private handleControlFrame(frame: BridgeFrame): void {
    const sessionId = frame.payload?.sessionId as string;

    switch (frame.type) {
      case 'voice.session_start': {
        // Acknowledgment from voice service — session confirmed
        if (frame.payload?.success) {
          logger.log(`voice-module: session confirmed by voice service`);
        }
        break;
      }

      case 'voice.speech_complete': {
        // JARVIS finished speaking — enter follow-up window
        if (sessionId === this.sessionId) {
          this.player.stop();
          this.state = 'streaming'; // Mic stays hot for follow-up
          this.startFollowUpTimer();
          logger.log('voice-module: speech complete, follow-up window open');
        }
        break;
      }

      case 'voice.playback_stop': {
        // Voice service requesting playback stop (barge-in processed)
        if (sessionId === this.sessionId) {
          this.player.stop();
        }
        break;
      }

      case 'voice.session_end': {
        // Session ending
        if (sessionId === this.sessionId) {
          this.endSession(frame.payload?.reason as string ?? 'ended');
        }
        break;
      }

      case 'voice.transcript': {
        // Interim transcript from voice service — could display in UI
        // For now, just log it
        if (sessionId === this.sessionId) {
          const text = frame.payload?.text as string;
          const isFinal = frame.payload?.isFinal as boolean;
          if (text) {
            logger.log(`transcript${isFinal ? ' (final)' : ''}: ${text}`);
          }
        }
        break;
      }

      case 'voice.proactive': {
        // JARVIS-initiated speech (alert, notification, etc.)
        this.handleProactiveMessage(frame);
        break;
      }
    }
  }

  /** Handle a proactive JARVIS-initiated voice message */
  private handleProactiveMessage(frame: BridgeFrame): void {
    const proactiveSessionId = frame.payload?.sessionId as string;
    const text = frame.payload?.text as string;
    if (!proactiveSessionId) return;

    logger.log(`voice-module: proactive message received: "${text ?? ''}"`);

    // If currently in a session, ignore proactive (user interaction takes priority)
    if (this.state !== 'idle') {
      logger.log('voice-module: ignoring proactive — session active');
      return;
    }

    // Play proactive chime, then set up to receive audio
    this.feedback.playChime('proactive');
    this.sessionId = proactiveSessionId;
    this.state = 'playing';

    // Auto-end proactive session after 30 seconds if not already ended
    setTimeout(() => {
      if (this.sessionId === proactiveSessionId && this.state === 'playing') {
        this.endSession('proactive_timeout');
      }
    }, 30_000);
  }

  private startFollowUpTimer(): void {
    this.clearFollowUpTimer();
    // Follow-up window: keep mic hot for 8 seconds
    this.followUpTimer = setTimeout(() => {
      if (this.state === 'streaming' && this.sessionId) {
        this.endSession('timeout');
      }
    }, 8000);
  }

  private clearFollowUpTimer(): void {
    if (this.followUpTimer) {
      clearTimeout(this.followUpTimer);
      this.followUpTimer = null;
    }
  }

  private endSession(reason: string): void {
    logger.log(`voice-module: session ended (${reason})`);

    this.player.stop();
    this.clearFollowUpTimer();

    if (this.sessionId) {
      sendFrame({
        type: 'voice.session_end',
        id: randomUUID(),
        payload: { sessionId: this.sessionId, reason },
      });
    }

    this.feedback.playChime('sessionEnd');
    this.sessionId = null;
    this.state = 'idle';
  }
}
