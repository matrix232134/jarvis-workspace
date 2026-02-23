/**
 * Deepgram Nova-3 raw WebSocket client for streaming STT.
 * Receives PCM audio, emits transcripts with interim/final status.
 */

import WebSocket from 'ws';
import * as logger from '../logger.js';

export interface DeepgramConfig {
  apiKey: string;
  model: string;
  language: string;
  sampleRate: number;
  encoding: string;
  channels: number;
  endpointing: number;
  interimResults: boolean;
  punctuate: boolean;
  smartFormat: boolean;
  vadEvents: boolean;
  utteranceEndMs: number;
}

export interface TranscriptEvent {
  transcript: string;
  isFinal: boolean;
  speechFinal: boolean;
  confidence: number;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const KEEPALIVE_INTERVAL_MS = 10_000;

export class DeepgramClient {
  private config: DeepgramConfig;
  private ws: WebSocket | null = null;
  private _connected = false;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private backoff = RECONNECT_BASE_MS;

  onTranscript: ((event: TranscriptEvent) => void) | null = null;
  onSpeechStarted: (() => void) | null = null;
  onUtteranceEnd: (() => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(config: DeepgramConfig) {
    this.config = config;
  }

  connect(): void {
    this.stopped = false;
    this._connect();
  }

  disconnect(): void {
    this.stopped = true;
    this.stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      // Send CloseStream before closing
      try {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch { /* ignore */ }
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }

  /** Send raw PCM audio data for transcription */
  sendAudio(audio: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audio, { binary: true });
    }
  }

  /** Send keepalive to prevent timeout */
  keepAlive(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
    }
  }

  // --- private ---

  private _connect(): void {
    if (this.stopped) return;

    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      encoding: this.config.encoding,
      sample_rate: String(this.config.sampleRate),
      channels: String(this.config.channels),
      punctuate: String(this.config.punctuate),
      smart_format: String(this.config.smartFormat),
      interim_results: String(this.config.interimResults),
      endpointing: String(this.config.endpointing),
      utterance_end_ms: String(this.config.utteranceEndMs),
      vad_events: String(this.config.vadEvents),
    });

    const url = `wss://api.deepgram.com/v1/listen?${params}`;
    logger.log('deepgram: connecting...');

    try {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${this.config.apiKey}`,
        },
      });
    } catch (err) {
      logger.error(`deepgram: WebSocket creation failed: ${err}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this._connected = true;
      this.backoff = RECONNECT_BASE_MS;
      this.startKeepalive();
      logger.log('deepgram: connected');
      this.onOpen?.();
    });

    this.ws.on('message', (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === 'Results') {
        const channel = msg.channel as Record<string, unknown>;
        const alternatives = (channel?.alternatives as Array<Record<string, unknown>>) ?? [];
        if (alternatives.length === 0) return;

        const best = alternatives[0];
        const transcript = (best.transcript as string) ?? '';
        const confidence = (best.confidence as number) ?? 0;
        const isFinal = (msg.is_final as boolean) ?? false;
        const speechFinal = (msg.speech_final as boolean) ?? false;

        if (transcript) {
          this.onTranscript?.({ transcript, isFinal, speechFinal, confidence });
        }
      } else if (type === 'SpeechStarted') {
        this.onSpeechStarted?.();
      } else if (type === 'UtteranceEnd') {
        this.onUtteranceEnd?.();
      } else if (type === 'Metadata') {
        // Connection metadata — logged for debugging
        logger.log(`deepgram: metadata received (request_id: ${msg.request_id})`);
      } else if (type === 'Error') {
        logger.error(`deepgram: error from server: ${JSON.stringify(msg)}`);
      }
    });

    this.ws.on('close', () => {
      this._connected = false;
      this.stopKeepalive();
      this.onClose?.();
      if (!this.stopped) {
        logger.warn('deepgram: connection lost, reconnecting...');
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      logger.error(`deepgram: ws error: ${err.message}`);
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, RECONNECT_MAX_MS);
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      this.keepAlive();
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }
}
