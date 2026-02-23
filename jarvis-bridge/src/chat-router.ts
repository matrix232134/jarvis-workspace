import type WebSocket from 'ws';
import type { BridgeFrame, ChatMessage, BridgeConfig } from './types.js';
import * as openclaw from './openclaw-client.js';
import * as logger from './logger.js';

function send(ws: WebSocket, frame: BridgeFrame): void {
  ws.send(JSON.stringify(frame));
}

export async function handleChat(
  ws: WebSocket,
  frame: BridgeFrame,
  deviceId: string,
  config: BridgeConfig
): Promise<void> {
  const messages = frame.payload.messages as ChatMessage[] | undefined;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    send(ws, { type: 'error', id: frame.id, payload: { message: 'Missing messages array' } });
    return;
  }

  try {
    const content = await openclaw.chat(messages, deviceId, config);
    send(ws, {
      type: 'chat.response',
      id: frame.id,
      payload: { content },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Chat relay failed for ${deviceId}: ${msg}`);
    send(ws, {
      type: 'error',
      id: frame.id,
      payload: { message: `Chat relay failed: ${msg}` },
    });
  }
}
