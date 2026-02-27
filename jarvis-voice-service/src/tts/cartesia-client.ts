/**
 * Cartesia Sonic-3 TTS WebSocket client.
 *
 * Uses context_id multiplexing to synthesize multiple sentences
 * concurrently on a single connection. Streams audio chunks back
 * in real-time for low-latency playback.
 */

import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import * as logger from '../logger.js';

export interface CartesiaConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  version: string;
  sampleRate: number;
  encoding: string;
  language: string;
}

interface PendingContext {
  chunks: Buffer[];
  onChunk?: (chunk: Buffer) => void;
  resolve: (audio: Buffer) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const CONNECT_TIMEOUT_MS = 10_000;
const SYNTHESIS_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 15_000;

export class CartesiaClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingContext>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = RECONNECT_BASE_MS;
  private _connected = false;
  private stopped = false;
  private config: CartesiaConfig;

  constructor(config: CartesiaConfig) {
    this.config = config;
  }

  connect(): void {
    this.stopped = false;
    this._connect();
  }

  disconnect(): void {
    this.stopped = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.rejectAllPending('Cartesia client disconnected');
  }

  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Synthesize text to audio. Returns the full audio buffer.
   * If onChunk is provided, each audio chunk is emitted as it arrives
   * for streaming playback.
   */
  async synthesize(
    text: string,
    contextId?: string,
    onChunk?: (chunk: Buffer) => void,
    controls?: { speed?: number; emotion?: string[] | null },
  ): Promise<Buffer> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Cartesia not connected');
    }

    const ctxId = contextId ?? uuid();

    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(ctxId);
        reject(new Error(`TTS synthesis timed out for context ${ctxId}`));
      }, SYNTHESIS_TIMEOUT_MS);

      this.pending.set(ctxId, { chunks: [], onChunk, resolve, reject, timer });

      // Build voice object with optional experimental controls
      const voice: Record<string, unknown> = { mode: 'id', id: this.config.voiceId };
      if (controls) {
        const expControls: Record<string, unknown> = {};
        if (controls.speed !== undefined && controls.speed !== 0) {
          expControls.speed = controls.speed;  // -1.0 to 1.0
        }
        if (controls.emotion && controls.emotion.length > 0) {
          expControls.emotion = controls.emotion;  // e.g. ['anger:lowest']
        }
        if (Object.keys(expControls).length > 0) {
          voice.__experimental_controls = expControls;
        }
      }

      this.ws!.send(JSON.stringify({
        model_id: this.config.modelId,
        transcript: text,
        continue: false,
        context_id: ctxId,
        voice,
        output_format: {
          container: 'raw',
          encoding: this.config.encoding,
          sample_rate: this.config.sampleRate,
        },
        language: this.config.language,
      }));
    });
  }

  // --- private ---

  private _connect(): void {
    if (this.stopped) return;

    const url = `wss://api.cartesia.ai/tts/websocket?api_key=${this.config.apiKey}&cartesia_version=${this.config.version}`;
    logger.log('cartesia: connecting...');

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      logger.error(`cartesia: WebSocket creation failed: ${err}`);
      this.scheduleReconnect();
      return;
    }

    const connectTimeout = setTimeout(() => {
      if (!this._connected && this.ws) {
        logger.error('cartesia: connection timeout');
        this.ws.close();
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.on('open', () => {
      clearTimeout(connectTimeout);
      this._connected = true;
      this.backoff = RECONNECT_BASE_MS;
      this.startPing();
      logger.log('cartesia: connected');
    });

    this.ws.on('message', (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const ctxId = msg.context_id as string;
      if (!ctxId) return;

      const ctx = this.pending.get(ctxId);
      if (!ctx) return;

      if (msg.type === 'chunk' && typeof msg.data === 'string') {
        const audio = Buffer.from(msg.data, 'base64');
        ctx.chunks.push(audio);
        ctx.onChunk?.(audio);
      } else if (msg.type === 'done') {
        clearTimeout(ctx.timer);
        this.pending.delete(ctxId);
        ctx.resolve(Buffer.concat(ctx.chunks));
      } else if (msg.type === 'error') {
        clearTimeout(ctx.timer);
        this.pending.delete(ctxId);
        ctx.reject(new Error(`Cartesia error: ${msg.error ?? 'unknown'}`));
      }
    });

    this.ws.on('close', () => {
      clearTimeout(connectTimeout);
      this._connected = false;
      this.stopPing();
      this.rejectAllPending('Cartesia connection lost');
      if (!this.stopped) {
        logger.warn('cartesia: connection lost, reconnecting...');
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      logger.error(`cartesia: ws error: ${err.message}`);
    });
  }

  private rejectAllPending(reason: string): void {
    for (const [id, ctx] of this.pending) {
      clearTimeout(ctx.timer);
      ctx.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, RECONNECT_MAX_MS);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
