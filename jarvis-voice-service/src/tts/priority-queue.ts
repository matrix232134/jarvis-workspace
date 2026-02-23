import { SpeechPriority, type SpeechItem } from '../types.js';

export class SpeechPriorityQueue {
  private buckets: SpeechItem[][] = [[], [], [], [], []];
  private maxDepth = 5;

  enqueue(item: SpeechItem): void {
    const bucket = this.buckets[item.priority];
    if (item.priority === SpeechPriority.AMBIENT && this.totalSize() >= this.maxDepth) {
      return; // Drop ambient items when queue is full
    }
    bucket.push(item);
  }

  dequeue(): SpeechItem | undefined {
    for (const bucket of this.buckets) {
      if (bucket.length > 0) {
        return bucket.shift();
      }
    }
    return undefined;
  }

  peek(): SpeechItem | undefined {
    for (const bucket of this.buckets) {
      if (bucket.length > 0) {
        return bucket[0];
      }
    }
    return undefined;
  }

  /** Clear all items at or below the given priority level (higher number = lower priority) */
  clearBelow(priority: SpeechPriority): void {
    for (let i = priority; i <= SpeechPriority.AMBIENT; i++) {
      this.buckets[i] = [];
    }
  }

  /** Clear everything — used for barge-in */
  clearAll(): void {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i] = [];
    }
  }

  /** Clear all items for a specific session */
  clearSession(sessionId: string): void {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i] = this.buckets[i].filter(item => item.sessionId !== sessionId);
    }
  }

  totalSize(): number {
    return this.buckets.reduce((sum, b) => sum + b.length, 0);
  }

  isEmpty(): boolean {
    return this.totalSize() === 0;
  }
}
