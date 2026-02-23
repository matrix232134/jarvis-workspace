/**
 * Voice session routing for jarvis-bridge.
 *
 * Handles:
 * - voice.session_start: creates session, routes to voice service
 * - voice.session_end: ends session, notifies peers
 * - voice.barge_in: forwards to voice service
 * - Binary audio frames: zero-parse routing by session ID
 */

import type WebSocket from 'ws';
import type { BridgeFrame, VoiceSessionRecord } from './types.js';
import * as registry from './device-registry.js';
import * as logger from './logger.js';

// Binary audio frame header: [36-byte sessionId][1-byte direction][N bytes audio]
const SESSION_ID_LENGTH = 36;
const HEADER_LENGTH = SESSION_ID_LENGTH + 1;
const DIRECTION_UPSTREAM = 0x00;
const DIRECTION_DOWNSTREAM = 0x01;

const voiceSessions = new Map<string, VoiceSessionRecord>();

function send(ws: WebSocket, frame: BridgeFrame): void {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(frame));
  }
}

export function handleVoiceSessionStart(ws: WebSocket, frame: BridgeFrame, deviceId: string): void {
  const sessionId = frame.payload.sessionId as string;
  if (!sessionId) {
    send(ws, { type: 'error', id: frame.id, payload: { message: 'Missing sessionId' } });
    return;
  }

  // If session already exists, this is a confirmation/response — route to the peer
  const existing = voiceSessions.get(sessionId);
  if (existing) {
    if (deviceId === existing.voiceServiceId) {
      // Voice service confirming → route to device
      const device = registry.getConnected(existing.deviceId);
      if (device) send(device.ws, frame);
    } else if (deviceId === existing.deviceId) {
      // Device re-sending → route to voice service
      const voiceService = registry.getConnected(existing.voiceServiceId);
      if (voiceService) send(voiceService.ws, frame);
    }
    return;
  }

  // Find the voice service
  const voiceService = registry.findByCapability('voice-service');
  if (!voiceService) {
    send(ws, { type: 'error', id: frame.id, payload: { message: 'No voice service connected' } });
    return;
  }

  // Create session record
  const session: VoiceSessionRecord = {
    sessionId,
    deviceId,
    voiceServiceId: voiceService.id,
    startedAt: new Date(),
    state: 'active',
  };
  voiceSessions.set(sessionId, session);

  // Forward to voice service with device info and capabilities
  const originDevice = registry.getConnected(deviceId);
  send(voiceService.ws, {
    type: 'voice.session_start',
    id: frame.id,
    payload: { ...frame.payload, deviceId, capabilities: originDevice?.capabilities ?? [] },
  });

  logger.log(`voice-router: session ${sessionId} started (device=${deviceId} → voice=${voiceService.id})`);
}

export function handleVoiceSessionEnd(ws: WebSocket, frame: BridgeFrame, deviceId: string): void {
  const sessionId = frame.payload.sessionId as string;
  if (!sessionId) return;

  const session = voiceSessions.get(sessionId);
  if (!session) return;

  session.state = 'ended';
  voiceSessions.delete(sessionId);

  // Forward to the peer (if device ends, notify voice service; if voice service ends, notify device)
  if (deviceId === session.deviceId) {
    const voiceService = registry.getConnected(session.voiceServiceId);
    if (voiceService) send(voiceService.ws, frame);
  } else {
    const device = registry.getConnected(session.deviceId);
    if (device) send(device.ws, frame);
  }

  logger.log(`voice-router: session ${sessionId} ended by ${deviceId}`);
}

export function handleVoiceBargeIn(ws: WebSocket, frame: BridgeFrame, deviceId: string): void {
  const sessionId = frame.payload.sessionId as string;
  if (!sessionId) return;

  const session = voiceSessions.get(sessionId);
  if (!session) return;

  // Forward barge-in to voice service
  const voiceService = registry.getConnected(session.voiceServiceId);
  if (voiceService) {
    send(voiceService.ws, frame);
  }

  logger.log(`voice-router: barge-in on session ${sessionId} (keyword=${frame.payload.keyword})`);
}

export function handleVoiceControlFrame(ws: WebSocket, frame: BridgeFrame, deviceId: string): void {
  // Proactive messages from voice service target a specific device directly
  if (frame.type === 'voice.proactive') {
    const targetDeviceId = frame.payload.targetDeviceId as string;
    if (targetDeviceId) {
      const device = registry.getConnected(targetDeviceId);
      if (device) send(device.ws, frame);
      return;
    }
    // Broadcast to all voice-capable devices if no target specified
    for (const conn of registry.getAllConnected()) {
      if (conn.capabilities.includes('voice') && conn.id !== deviceId) {
        send(conn.ws, frame);
      }
    }
    return;
  }

  const sessionId = frame.payload.sessionId as string;
  if (!sessionId) return;

  const session = voiceSessions.get(sessionId);
  if (!session) return;

  // Route control frames between voice service and device
  if (deviceId === session.voiceServiceId) {
    // From voice service → route to device
    const device = registry.getConnected(session.deviceId);
    if (device) send(device.ws, frame);
  } else if (deviceId === session.deviceId) {
    // From device → route to voice service
    const voiceService = registry.getConnected(session.voiceServiceId);
    if (voiceService) send(voiceService.ws, frame);
  }
}

export function handleAudio(data: Buffer, sourceDeviceId: string): void {
  if (data.length < HEADER_LENGTH) return;

  const sessionId = data.subarray(0, SESSION_ID_LENGTH).toString('ascii');
  const direction = data[SESSION_ID_LENGTH];

  const session = voiceSessions.get(sessionId);
  if (!session || session.state !== 'active') return;

  if (direction === DIRECTION_UPSTREAM) {
    // From device → voice service
    const voiceService = registry.getConnected(session.voiceServiceId);
    if (voiceService) {
      voiceService.ws.send(data, { binary: true });
    }
  } else if (direction === DIRECTION_DOWNSTREAM) {
    // From voice service → device
    const device = registry.getConnected(session.deviceId);
    if (device) {
      device.ws.send(data, { binary: true });
    }
  }
}

/** Clean up sessions for a disconnected device */
export function removeDevice(deviceId: string): void {
  for (const [sessionId, session] of voiceSessions) {
    if (session.deviceId === deviceId || session.voiceServiceId === deviceId) {
      voiceSessions.delete(sessionId);
      logger.log(`voice-router: session ${sessionId} cleaned up (device ${deviceId} disconnected)`);

      // Notify the peer
      const peerId = session.deviceId === deviceId ? session.voiceServiceId : session.deviceId;
      const peer = registry.getConnected(peerId);
      if (peer) {
        send(peer.ws, {
          type: 'voice.session_end',
          id: '',
          payload: { sessionId, reason: 'peer_disconnected' },
        });
      }
    }
  }
}
