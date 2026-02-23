import { WebSocketServer, WebSocket } from 'ws';
import type { BridgeFrame, BridgeConfig } from './types.js';
import { handleAuth } from './auth.js';
import { handleChat } from './chat-router.js';
import { handleDeviceCommand, handleDeviceResponse, removeDevice } from './device-router.js';
import * as voiceRouter from './voice-router.js';
import * as registry from './device-registry.js';
import * as logger from './logger.js';

const AUTH_TIMEOUT_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;

// Clients subscribed to device change events
const deviceSubscribers = new Set<WebSocket>();

export function startServer(config: BridgeConfig): void {
  const wss = new WebSocketServer({ host: config.host, port: config.port });

  logger.log(`Bridge listening on ${config.host}:${config.port}`);

  // Broadcast device changes to all subscribers
  registry.events.on('change', (event: { event: string; deviceId: string; device?: unknown }) => {
    const frame: BridgeFrame = {
      type: 'device.change',
      id: '',
      payload: event as Record<string, unknown>,
    };
    const msg = JSON.stringify(frame);
    for (const sub of deviceSubscribers) {
      if (sub.readyState === WebSocket.OPEN) {
        sub.send(msg);
      }
    }

    // Notify voice service about screen device availability changes
    const voiceService = registry.findByCapability('voice-service');
    if (voiceService) {
      const hasScreen = !!registry.findByCapability('screen');
      const capFrame: BridgeFrame = {
        type: 'device.capability_change',
        id: '',
        payload: {
          event: event.event,
          deviceId: event.deviceId,
          hasScreenDevice: hasScreen,
        },
      };
      if (voiceService.ws.readyState === WebSocket.OPEN) {
        voiceService.ws.send(JSON.stringify(capFrame));
      }
    }
  });

  wss.on('connection', (ws) => {
    let deviceId: string | null = null;
    let alive = true;

    // Auth timeout — disconnect if no auth frame within 5s
    const authTimer = setTimeout(() => {
      if (!deviceId) {
        logger.warn('Connection closed: no auth within timeout');
        ws.close(4001, 'Auth timeout');
      }
    }, AUTH_TIMEOUT_MS);

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (!alive) {
        logger.warn(`Device ${deviceId ?? 'unknown'} heartbeat timeout, closing`);
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL_MS);

    ws.on('pong', () => {
      alive = true;
    });

    ws.on('message', async (data, isBinary) => {
      // Binary frames = voice audio — fast path, no JSON parsing
      if (isBinary) {
        if (deviceId) {
          voiceRouter.handleAudio(data as Buffer, deviceId);
        }
        return;
      }

      let frame: BridgeFrame;
      try {
        frame = JSON.parse(data.toString()) as BridgeFrame;
      } catch {
        ws.send(JSON.stringify({ type: 'error', id: '', payload: { message: 'Invalid JSON' } }));
        return;
      }

      // Handle auth
      if (frame.type === 'auth') {
        clearTimeout(authTimer);
        deviceId = handleAuth(ws, frame, config);
        if (!deviceId) {
          ws.close(4003, 'Auth failed');
        }
        return;
      }

      // Require auth for everything else
      if (!deviceId) {
        ws.send(JSON.stringify({ type: 'error', id: frame.id, payload: { message: 'Not authenticated' } }));
        return;
      }

      // Handle chat
      if (frame.type === 'chat') {
        await handleChat(ws, frame, deviceId, config);
        return;
      }

      // Handle device commands (routed to target device)
      if (frame.type === 'device.command') {
        handleDeviceCommand(ws, frame, deviceId);
        return;
      }

      // Handle device responses (routed back to requester)
      if (frame.type === 'device.response') {
        handleDeviceResponse(ws, frame, deviceId);
        return;
      }

      // Handle device list query
      if (frame.type === 'device.list') {
        const devices = registry.getAllConnectedInfo();
        ws.send(JSON.stringify({
          type: 'device.list.response',
          id: frame.id,
          payload: { devices },
        }));
        return;
      }

      // Handle device change subscription
      if (frame.type === 'device.subscribe') {
        deviceSubscribers.add(ws);
        ws.send(JSON.stringify({
          type: 'device.subscribe',
          id: frame.id,
          payload: { subscribed: true },
        }));
        logger.log(`Device ${deviceId} subscribed to device changes`);
        return;
      }

      // Handle voice control frames
      if (frame.type === 'voice.session_start') {
        voiceRouter.handleVoiceSessionStart(ws, frame, deviceId);
        return;
      }
      if (frame.type === 'voice.session_end') {
        voiceRouter.handleVoiceSessionEnd(ws, frame, deviceId);
        return;
      }
      if (frame.type === 'voice.barge_in') {
        voiceRouter.handleVoiceBargeIn(ws, frame, deviceId);
        return;
      }
      // voice.display / voice.artifact: route to all screen-capable devices (not session-based)
      if (frame.type === 'voice.display' || frame.type === 'voice.artifact') {
        for (const conn of registry.getAllConnected()) {
          if (conn.capabilities.includes('screen') && conn.id !== deviceId) {
            if (conn.ws.readyState === WebSocket.OPEN) {
              conn.ws.send(JSON.stringify(frame));
            }
          }
        }
        return;
      }

      if (frame.type === 'voice.speech_end' || frame.type === 'voice.transcript' ||
          frame.type === 'voice.playback_stop' || frame.type === 'voice.speech_complete' ||
          frame.type === 'voice.proactive') {
        voiceRouter.handleVoiceControlFrame(ws, frame, deviceId);
        return;
      }

      // Handle pong (client-initiated)
      if (frame.type === 'pong') {
        alive = true;
        return;
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      clearInterval(heartbeat);
      deviceSubscribers.delete(ws);
      removeDevice(ws);
      if (deviceId) {
        voiceRouter.removeDevice(deviceId);
        registry.disconnect(deviceId);
        logger.log(`Device disconnected: ${deviceId}`);
      }
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket error: ${err.message}`);
    });
  });

  wss.on('error', (err) => {
    logger.error(`Server error: ${err.message}`);
  });
}
