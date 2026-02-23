/**
 * WebSocket client for connecting the voice service to jarvis-bridge.
 * Supports both JSON control frames and binary audio frames.
 */

import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import { AUDIO_HEADER_LENGTH, type BridgeFrame } from './types.js';
import * as logger from './logger.js';

interface BridgeClientConfig {
  url: string;
  deviceId: string;
  token: string;
}

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

export class VoiceBridgeClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = RECONNECT_BASE_MS;
  private _connected = false;
  private stopped = false;
  private config: BridgeClientConfig;

  /** Handler for JSON control frames (voice.session_start, voice.barge_in, etc.) */
  onFrame: ((frame: BridgeFrame) => void) | null = null;
  /** Handler for binary audio frames (upstream mic audio from devices) */
  onAudio: ((sessionId: string, audio: Buffer) => void) | null = null;

  constructor(config: BridgeClientConfig) {
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
  }

  isConnected(): boolean {
    return this._connected;
  }

  /** Send a JSON control frame */
  sendFrame(frame: BridgeFrame): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  /** Send a binary audio frame (downstream TTS audio to device) */
  sendAudio(sessionId: string, audio: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const header = Buffer.alloc(AUDIO_HEADER_LENGTH);
    header.write(sessionId, 0, 36, 'ascii');
    header[36] = 0x01; // downstream
    const frame = Buffer.concat([header, audio]);
    this.ws.send(frame, { binary: true });
  }

  // --- private ---

  private _connect(): void {
    if (this.stopped) return;

    logger.log(`voice-bridge: connecting to ${this.config.url}`);

    try {
      this.ws = new WebSocket(this.config.url);
    } catch (err) {
      logger.error(`voice-bridge: WebSocket creation failed: ${err}`);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.backoff = RECONNECT_BASE_MS;
      this.authenticate();
      this.startPing();
    });

    this.ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.handleBinaryFrame(data as Buffer);
        return;
      }

      let frame: BridgeFrame;
      try {
        frame = JSON.parse(data.toString()) as BridgeFrame;
      } catch {
        return;
      }

      if (frame.type === 'auth') {
        if (frame.payload.success) {
          this._connected = true;
          logger.log(`voice-bridge: authenticated as ${this.config.deviceId}`);
        } else {
          logger.error(`voice-bridge: auth failed: ${frame.payload.message}`);
          this.ws?.close();
        }
        return;
      }

      this.onFrame?.(frame);
    });

    this.ws.on('close', () => {
      this._connected = false;
      this.stopPing();
      if (!this.stopped) {
        logger.warn('voice-bridge: connection lost, reconnecting...');
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      logger.error(`voice-bridge: ws error: ${err.message}`);
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });
  }

  private authenticate(): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({
      type: 'auth',
      id: uuid(),
      payload: {
        deviceId: this.config.deviceId,
        token: this.config.token,
        capabilities: ['voice-service'],
      },
    }));
  }

  private handleBinaryFrame(data: Buffer): void {
    if (data.length < AUDIO_HEADER_LENGTH) return;

    const sessionId = data.subarray(0, 36).toString('ascii');
    // Byte 36 is direction — 0x00 = upstream (mic audio from device)
    const audio = data.subarray(AUDIO_HEADER_LENGTH);
    this.onAudio?.(sessionId, audio);
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
        this.ws.send(JSON.stringify({ type: 'pong', id: uuid(), payload: {} }));
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
