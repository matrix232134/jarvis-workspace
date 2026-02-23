import type { ChatMessage, BridgeConfig } from './types.js';
import * as logger from './logger.js';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 180_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function chat(
  messages: ChatMessage[],
  userId: string,
  config: BridgeConfig
): Promise<string> {
  const url = `${config.openclaw.url}/v1/chat/completions`;
  const body = JSON.stringify({
    model: 'openclaw:main',
    messages,
    user: userId,
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      logger.warn(`Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openclaw.token}`,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json() as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content ?? '(no response)';
      }

      // Don't retry client errors (4xx) except 429
      const status = res.status;
      const text = await res.text();
      logger.error(`OpenClaw HTTP ${status}: ${text}`);

      if (status >= 400 && status < 500 && status !== 429) {
        throw new Error(`OpenClaw returned ${status}`);
      }

      lastError = new Error(`OpenClaw returned ${status}`);
    } catch (err) {
      clearTimeout(timeout);
      const error = err instanceof Error ? err : new Error(String(err));

      if (error.name === 'AbortError') {
        lastError = new Error('Gateway request timed out');
        logger.error(`OpenClaw request timed out (attempt ${attempt + 1})`);
      } else if (error.message.startsWith('OpenClaw returned 4')) {
        // Client error, don't retry
        throw error;
      } else {
        lastError = error;
        logger.error(`OpenClaw fetch error (attempt ${attempt + 1}): ${error.message}`);
      }
    }
  }

  throw lastError ?? new Error('Gateway request failed after retries');
}

/**
 * Stream chat completion tokens from OpenClaw via SSE.
 * Yields individual content tokens as they arrive.
 */
export async function* streamChat(
  messages: ChatMessage[],
  userId: string,
  config: BridgeConfig
): AsyncGenerator<string> {
  const url = `${config.openclaw.url}/v1/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openclaw.token}`,
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        messages,
        user: userId,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenClaw HTTP ${res.status}: ${text}`);
    }

    if (!res.body) {
      throw new Error('OpenClaw response has no body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch { /* skip malformed chunk */ }
        }
      }
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gateway request timed out');
    }
    throw err;
  }
}
