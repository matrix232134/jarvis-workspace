import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import type { BridgeFrame, DeviceAgentConfig, CommandPayload } from './types.js';
import { saveConfig } from './config.js';
import { dispatch } from './subsystem-registry.js';
import * as logger from './logger.js';

const RECONNECT_DELAY_MS = 3000;
const PING_INTERVAL_MS = 25000;

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let binaryHandler: ((data: Buffer) => void) | null = null;
let frameHandler: ((frame: BridgeFrame) => void) | null = null;

/** Register a handler for binary WebSocket frames (voice audio) */
export function onBinaryFrame(handler: (data: Buffer) => void): void {
  binaryHandler = handler;
}

/** Register a handler for JSON frames that aren't handled by default routing */
export function onJsonFrame(handler: (frame: BridgeFrame) => void): void {
  frameHandler = handler;
}

/** Send a binary frame (voice audio) through the bridge */
export function sendBinary(data: Buffer): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data, { binary: true });
  }
}

/** Send a JSON frame through the bridge */
export function sendFrame(frame: BridgeFrame): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(frame));
  }
}

export function connect(config: DeviceAgentConfig): void {
  if (ws) {
    ws.removeAllListeners();
    ws.close();
  }

  logger.log(`Connecting to bridge at ${config.bridge.url}...`);
  ws = new WebSocket(config.bridge.url);

  ws.on('open', () => {
    logger.log('Connected to bridge');
    authenticate(config);
    startPing();
  });

  ws.on('message', async (data, isBinary) => {
    // Binary frames = voice audio — route to binary handler
    if (isBinary) {
      binaryHandler?.(data as Buffer);
      return;
    }

    let frame: BridgeFrame;
    try {
      frame = JSON.parse(data.toString()) as BridgeFrame;
    } catch {
      logger.warn('Received invalid JSON from bridge');
      return;
    }

    if (frame.type === 'auth') {
      handleAuthResponse(frame, config);
      return;
    }

    if (frame.type === 'device.command') {
      await handleCommand(frame);
      return;
    }

    if (frame.type === 'error') {
      logger.error(`Bridge error: ${frame.payload.message}`);
      return;
    }

    // Pass unhandled frames to the external frame handler (voice control frames, etc.)
    frameHandler?.(frame);
  });

  ws.on('close', (code, reason) => {
    logger.warn(`Disconnected from bridge (${code}: ${reason.toString()})`);
    stopPing();
    scheduleReconnect(config);
  });

  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err.message}`);
  });

  ws.on('ping', () => {
    ws?.pong();
  });
}

function authenticate(config: DeviceAgentConfig): void {
  if (!ws) return;

  const frame: BridgeFrame = {
    type: 'auth',
    id: uuid(),
    payload: config.bridge.deviceId && config.bridge.token
      ? {
          deviceId: config.bridge.deviceId,
          token: config.bridge.token,
          capabilities: config.capabilities,
        }
      : {
          pairingToken: config.bridge.pairingToken,
          deviceName: config.device.name,
          capabilities: config.capabilities,
        },
  };

  ws.send(JSON.stringify(frame));
}

function handleAuthResponse(frame: BridgeFrame, config: DeviceAgentConfig): void {
  if (!frame.payload.success) {
    logger.error(`Auth failed: ${frame.payload.message}`);
    return;
  }

  const deviceId = frame.payload.deviceId as string;
  logger.log(`Authenticated as device: ${deviceId}`);

  // Save credentials if this was a pairing
  if (frame.payload.paired) {
    const token = frame.payload.token as string;
    config.bridge.deviceId = deviceId;
    config.bridge.token = token;
    saveConfig(config);
    logger.log('Saved pairing credentials to config');
  }
}

async function handleCommand(frame: BridgeFrame): Promise<void> {
  const payload = frame.payload as unknown as CommandPayload;
  const { subsystem, action, params } = payload;

  logger.log(`Command received: ${subsystem}.${action}`);

  const result = await dispatch(subsystem, action, params ?? {});

  const response: BridgeFrame = {
    type: 'device.response',
    id: frame.id,
    payload: result as unknown as Record<string, unknown>,
  };

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'pong', id: uuid(), payload: {} }));
    }
  }, PING_INTERVAL_MS);
}

function stopPing(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function scheduleReconnect(config: DeviceAgentConfig): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    logger.log('Attempting reconnection...');
    connect(config);
  }, RECONNECT_DELAY_MS);
}
