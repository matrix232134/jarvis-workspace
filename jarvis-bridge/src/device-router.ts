import type WebSocket from 'ws';
import type { BridgeFrame } from './types.js';
import * as registry from './device-registry.js';
import * as logger from './logger.js';

// Maps command frame ID → requester's WebSocket + source device ID
const pendingCommands = new Map<string, { ws: WebSocket; sourceDeviceId: string }>();

function send(ws: WebSocket, frame: BridgeFrame): void {
  ws.send(JSON.stringify(frame));
}

export function handleDeviceCommand(ws: WebSocket, frame: BridgeFrame, sourceDeviceId: string): void {
  const payload = frame.payload;
  const targetDeviceId = payload.targetDeviceId as string | undefined;
  const subsystem = payload.subsystem as string | undefined;
  const action = payload.action as string | undefined;

  if (!targetDeviceId || !subsystem || !action) {
    send(ws, {
      type: 'device.response',
      id: frame.id,
      payload: { success: false, error: 'Missing targetDeviceId, subsystem, or action' },
    });
    return;
  }

  const target = registry.getConnected(targetDeviceId);
  if (!target) {
    send(ws, {
      type: 'device.response',
      id: frame.id,
      payload: { success: false, error: `Device ${targetDeviceId} not connected` },
    });
    return;
  }

  // Verify target has the requested capability (_control is always allowed)
  if (subsystem !== '_control' && !target.capabilities.includes(subsystem)) {
    send(ws, {
      type: 'device.response',
      id: frame.id,
      payload: { success: false, error: `Device ${targetDeviceId} does not have capability: ${subsystem}` },
    });
    return;
  }

  // Store requester for response routing
  pendingCommands.set(frame.id, { ws, sourceDeviceId });

  // Forward command to target device
  send(target.ws, frame);
  logger.log(`Device command routed: ${sourceDeviceId} → ${targetDeviceId} [${subsystem}.${action}]`);
}

export function handleDeviceResponse(ws: WebSocket, frame: BridgeFrame, sourceDeviceId: string): void {
  const pending = pendingCommands.get(frame.id);
  if (!pending) {
    logger.warn(`Device response with unknown command ID: ${frame.id} from ${sourceDeviceId}`);
    return;
  }

  pendingCommands.delete(frame.id);

  // Forward response back to the original requester
  try {
    send(pending.ws, frame);
    logger.log(`Device response routed: ${sourceDeviceId} → ${pending.sourceDeviceId} [${frame.id}]`);
  } catch {
    logger.warn(`Failed to route device response to ${pending.sourceDeviceId} (disconnected?)`);
  }
}

export function removeDevice(ws: WebSocket): void {
  // Clean up any pending commands where this device was the requester
  for (const [id, pending] of pendingCommands.entries()) {
    if (pending.ws === ws) {
      pendingCommands.delete(id);
    }
  }
}
