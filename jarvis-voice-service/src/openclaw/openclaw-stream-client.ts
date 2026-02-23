/**
 * Streaming HTTP client for OpenClaw /v1/chat/completions.
 * Uses SSE (Server-Sent Events) to yield tokens as they arrive.
 */

import * as logger from '../logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenClawConfig {
  url: string;
  token: string;
}

const REQUEST_TIMEOUT_MS = 120_000;

export class OpenClawStreamClient {
  private config: OpenClawConfig;

  constructor(config: OpenClawConfig) {
    this.config = config;
  }

  /**
   * Stream chat completion tokens from OpenClaw.
   * Yields individual content tokens as they arrive.
   * Pass an AbortSignal to cancel the stream (for barge-in).
   */
  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const url = `${this.config.url}/v1/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Compose signals: external signal + timeout
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.token}`,
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages,
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

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // Comment or empty

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Malformed JSON chunk, skip
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
          try {
            const parsed = JSON.parse(trimmed.slice(6)) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        logger.log('openclaw-stream: request aborted (barge-in or timeout)');
        return;
      }
      throw err;
    }
  }
}
