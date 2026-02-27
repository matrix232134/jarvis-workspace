import type WebSocket from 'ws';
import type { BridgeFrame, ChatMessage, BridgeConfig } from './types.js';
import * as openclaw from './openclaw-client.js';
import * as registry from './device-registry.js';
import * as logger from './logger.js';

// --- Smart model routing ---
// Routes simple/conversational messages to Sonnet (fast) and complex tasks to Opus (thorough).
// Zero-latency local heuristic — no extra API call.

const MODEL_FAST = 'anthropic/claude-sonnet-4-5';
const MODEL_DEEP = 'anthropic/claude-opus-4-6';

// Patterns that indicate a complex task needing Opus
const COMPLEX_PATTERNS = [
  /\b(analyze|analyse|debug|refactor|architect|implement|design|optimize|compare|contrast|evaluate)\b/i,
  /\b(step[- ]by[- ]step|in[- ]depth|detailed|thorough|comprehensive)\b/i,
  /\b(write|create|build|generate)\s+(a |an |the )?(full|complete|entire|complex)\b/i,
  /\b(research|investigate|explain\s+how|explain\s+why|break\s+down)\b/i,
  /```[\s\S]*```/,                     // Contains code blocks
  /\b(bug|error|exception|stack\s*trace|traceback)\b/i,
  /\b(multi[- ]?step|workflow|pipeline|strategy|plan)\b/i,
];

// Patterns that strongly indicate a simple task → Sonnet
const SIMPLE_PATTERNS = [
  /^(hi|hello|hey|good\s+(morning|afternoon|evening)|what's\s+up|how\s+are\s+you)\b/i,
  /^(thanks|thank\s+you|ok|okay|got\s+it|sure|yes|no|yep|nope)\b/i,
  /^(what|who|when|where)\s+(is|are|was|were)\b/i,  // Simple factual questions
  /^(set|turn|open|close|play|stop|pause|show|hide|toggle)\s/i,  // Device commands
  /^(remind|timer|alarm|schedule)\b/i,
];

function classifyComplexity(messages: ChatMessage[]): 'fast' | 'deep' {
  // Look at the last user message
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return 'fast';

  const text = lastUser.content;
  const wordCount = text.split(/\s+/).length;

  // Very short messages (< 15 words) — almost always simple
  if (wordCount < 15) {
    // Unless they match a complex pattern
    if (COMPLEX_PATTERNS.some(p => p.test(text))) return 'deep';
    return 'fast';
  }

  // Check for explicit simple patterns first
  if (SIMPLE_PATTERNS.some(p => p.test(text))) return 'fast';

  // Check for complex patterns
  if (COMPLEX_PATTERNS.some(p => p.test(text))) return 'deep';

  // Long messages (> 80 words) default to Opus
  if (wordCount > 80) return 'deep';

  // Medium-length messages default to Sonnet
  return 'fast';
}

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

  // Smart model routing
  const tier = classifyComplexity(messages);
  const model = tier === 'deep' ? MODEL_DEEP : MODEL_FAST;
  logger.log(`Chat routed → ${tier} (${model})`);

  // Resolve source device info for context
  const sourceDevice = registry.getConnected(deviceId);
  const deviceName = sourceDevice?.name ?? deviceId;
  const deviceCaps = sourceDevice?.capabilities ?? [];

  // Prepend channel context — JARVIS voice + display rules + device routing
  const withContext: ChatMessage[] = [
    {
      role: 'system',
      content: `Channel: workspace-ui (screen available). You are JARVIS.
User is chatting from device: ${deviceName} (device_id: ${deviceId}).
This device has capabilities: [${deviceCaps.join(', ')}].
When using device tools without an explicit device_id, pass device_id: "${deviceId}" to target this device.
For opening URLs or web searches, ALWAYS use device_browser_open or device_browser_search — these route to the user's browser automatically. Never use device_app_launch for URLs.

VOICE RULES:
- 1-2 sentences maximum. Never more than 3 unless delivering diagnostic detail.
- Lead with the answer. Use contractions naturally. Address user as "sir" ~40% of responses.
- Never start with "I". Drop pronouns for facts: "Build complete." "Latency at 340ms."
- No emoji, no exclamation marks, no "Sure", "Absolutely", "Happy to help", "Great question".

OUTPUT FORMAT:
- Plain text = what you say aloud. Keep it concise, personality-forward.
- [DISPLAY] = what you show on screen. Markdown tables, code, structured data. Never duplicates voice.
- [ARTIFACT type="..." title="..."]...[/ARTIFACT] = rich content (HTML, code, diagrams, dashboards). Renders in a side panel. Do NOT write files to disk.
- Keep voice brief ("Here's that demo, sir.") and put content in [DISPLAY] or [ARTIFACT].
- A 3-row table is a [DISPLAY]. A full page/visualization is an [ARTIFACT].
- Use canvas.a2ui.push for ambient visual content that should persist on the Canvas panel (system status, dashboards, live data).
- Use [DISPLAY] for inline structured data in conversation. Use [ARTIFACT] for rich creations (HTML pages, code, diagrams).`,
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

    for await (const token of openclaw.streamChat(withContext, deviceId, config, model)) {
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
