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

  // Prepend channel context so the LLM knows this client renders artifacts inline
  const withContext: ChatMessage[] = [
    {
      role: 'system',
      content: 'Channel: workspace-ui. This client renders [ARTIFACT] content in a side panel. For any creation request (HTML, code, diagrams, visualizations), output the content inside [ARTIFACT type="..." title="..."]...[/ARTIFACT] tags in your response. Do not write files to disk or open a browser — artifacts render live in the UI.',
    },
    ...messages,
  ];

  try {
    const parts: string[] = [];
    let tokenBuffer = '';
    let flushScheduled = false;

    const flushTokens = () => {
      if (tokenBuffer) {
        send(ws, { type: 'chat.token', id: frame.id, payload: { token: tokenBuffer } });
        tokenBuffer = '';
      }
      flushScheduled = false;
    };

    for await (const token of openclaw.streamChat(withContext, deviceId, config)) {
      parts.push(token);
      tokenBuffer += token;
      if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(flushTokens, 16); // ~1 frame at 60fps
      }
    }
    flushTokens(); // Final flush
    send(ws, { type: 'chat.done', id: frame.id, payload: { content: parts.join('') } });
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
