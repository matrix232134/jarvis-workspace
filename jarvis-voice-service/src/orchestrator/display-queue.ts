/**
 * Display Queue — RAM-only queue for [DISPLAY] content when no screen is connected.
 *
 * Stores display content that couldn't be delivered because no screen-capable
 * device was online. Flushes to screen when a device with 'screen' capability
 * reconnects.
 *
 * - Max 20 items (oldest dropped on overflow)
 * - 2-hour TTL per item
 * - Prune expired items every 5 minutes
 */

import * as logger from '../logger.js';

export interface QueuedDisplay {
  id: string;
  sessionId: string;
  content: string;
  queuedAt: number;
  expiresAt: number;
}

const MAX_ITEMS = 20;
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class DisplayQueue {
  private items: QueuedDisplay[] = [];
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.pruneTimer = setInterval(() => this.pruneExpired(), PRUNE_INTERVAL_MS);
  }

  /** Add a display item to the queue. Drops oldest if at capacity. */
  enqueue(sessionId: string, content: string): void {
    this.pruneExpired();

    if (this.items.length >= MAX_ITEMS) {
      const dropped = this.items.shift();
      if (dropped) {
        logger.log(`display-queue: dropped oldest item (queue full)`);
      }
    }

    const now = Date.now();
    this.items.push({
      id: crypto.randomUUID(),
      sessionId,
      content,
      queuedAt: now,
      expiresAt: now + TTL_MS,
    });

    logger.log(`display-queue: enqueued item (size: ${this.items.length})`);
  }

  /** Drain all queued items for flush-to-screen. Returns items and clears queue. */
  drain(): QueuedDisplay[] {
    this.pruneExpired();
    const items = [...this.items];
    this.items = [];
    return items;
  }

  /** Current queue size (prunes expired first). */
  get size(): number {
    this.pruneExpired();
    return this.items.length;
  }

  /** Clean up prune interval on shutdown. */
  destroy(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    const before = this.items.length;
    this.items = this.items.filter(item => item.expiresAt > now);
    const pruned = before - this.items.length;
    if (pruned > 0) {
      logger.log(`display-queue: pruned ${pruned} expired item(s)`);
    }
  }
}
