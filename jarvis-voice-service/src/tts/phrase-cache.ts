/**
 * Pre-generated audio cache for common phrases.
 * Synthesized at startup via Cartesia, stored in RAM as PCM buffers.
 * Used for speculative acknowledgment (~50ms response time).
 */

import type { CartesiaClient } from './cartesia-client.js';
import * as logger from '../logger.js';

const CACHED_PHRASES = [
  'Yes, sir.',
  'Will do, sir.',
  'Right away, sir.',
  'Noted.',
  'Done.',
  'As you wish.',
  'Check.',
  'On it, sir.',
  'Working on it.',
  'One moment, sir.',
  'Online and ready.',
  'Processing now.',
  'Details on your screen, sir.',
  "It's on display.",
  'Sir.',
  'Pardon the interruption, sir.',
  'My error. Corrected.',
  'Not certain about that, sir.',
  'Of course.',
  'Understood.',
];

export class PhraseCache {
  private cache = new Map<string, Buffer>();

  /** Warm the cache by synthesizing all phrases via Cartesia */
  async warmup(client: CartesiaClient): Promise<void> {
    logger.log(`phrase-cache: warming up ${CACHED_PHRASES.length} phrases...`);
    const start = Date.now();
    let succeeded = 0;

    // Synthesize in small batches to avoid overwhelming the connection
    const BATCH_SIZE = 4;
    for (let i = 0; i < CACHED_PHRASES.length; i += BATCH_SIZE) {
      const batch = CACHED_PHRASES.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(phrase => client.synthesize(phrase, `cache-${i + batch.indexOf(phrase)}`))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const phrase = batch[j];
        if (result.status === 'fulfilled') {
          this.cache.set(this.normalize(phrase), result.value);
          succeeded++;
        } else {
          logger.warn(`phrase-cache: failed to cache "${phrase}": ${result.reason}`);
        }
      }
    }

    const elapsed = Date.now() - start;
    logger.log(`phrase-cache: cached ${succeeded}/${CACHED_PHRASES.length} phrases in ${elapsed}ms`);
  }

  /** Look up cached audio for a phrase. Returns PCM buffer or undefined. */
  get(text: string): Buffer | undefined {
    return this.cache.get(this.normalize(text));
  }

  /** Check if a phrase is cached */
  has(text: string): boolean {
    return this.cache.has(this.normalize(text));
  }

  get size(): number {
    return this.cache.size;
  }

  private normalize(text: string): string {
    return text.toLowerCase().trim().replace(/[.!?,;:]+$/, '');
  }
}
