import type WebSocket from 'ws';
import type { BridgeFrame, BridgeConfig } from './types.js';
import * as registry from './device-registry.js';
import * as logger from './logger.js';
import { v4 as uuid } from 'uuid';

function send(ws: WebSocket, frame: BridgeFrame): void {
  ws.send(JSON.stringify(frame));
}

export function handleAuth(
  ws: WebSocket,
  frame: BridgeFrame,
  config: BridgeConfig
): string | null {
  const payload = frame.payload;

  // Existing device re-auth
  if (payload.deviceId && payload.token) {
    const deviceId = payload.deviceId as string;
    const token = payload.token as string;

    if (!registry.authenticate(deviceId, token)) {
      send(ws, { type: 'error', id: frame.id, payload: { message: 'Invalid credentials' } });
      return null;
    }

    const capabilities = Array.isArray(payload.capabilities) ? payload.capabilities as string[] : [];
    const conn = registry.connect(deviceId, ws, capabilities);
    if (!conn) {
      send(ws, { type: 'error', id: frame.id, payload: { message: 'Device not found' } });
      return null;
    }

    send(ws, { type: 'auth', id: frame.id, payload: { success: true, deviceId } });
    logger.log(`Device re-authenticated: ${conn.name} (${deviceId})${capabilities.length ? ` [${capabilities.join(', ')}]` : ''}`);
    return deviceId;
  }

  // First-time pairing
  if (payload.pairingToken && payload.deviceName) {
    const pairingToken = payload.pairingToken as string;
    const deviceName = payload.deviceName as string;

    if (pairingToken !== config.bridge.secret) {
      send(ws, { type: 'error', id: frame.id, payload: { message: 'Invalid pairing token' } });
      return null;
    }

    if (registry.registeredCount() >= config.bridge.maxDevices) {
      send(ws, { type: 'error', id: frame.id, payload: { message: 'Max devices reached' } });
      return null;
    }

    const capabilities = Array.isArray(payload.capabilities) ? payload.capabilities as string[] : [];
    const device = registry.register(deviceName);
    registry.connect(device.id, ws, capabilities);

    send(ws, {
      type: 'auth',
      id: frame.id,
      payload: { success: true, deviceId: device.id, token: device.token, paired: true },
    });
    logger.log(`New device paired: ${deviceName} (${device.id})${capabilities.length ? ` [${capabilities.join(', ')}]` : ''}`);
    return device.id;
  }

  send(ws, { type: 'error', id: frame.id, payload: { message: 'Invalid auth frame' } });
  return null;
}
