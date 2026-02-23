import type { ChatMessage, BridgeConfig } from './types.js';
import * as logger from './logger.js';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 60_000;

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
