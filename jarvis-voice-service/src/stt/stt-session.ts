/**
 * Per-session STT state tracking.
 * Accumulates interim/final transcripts and emits complete utterances.
 */

import type { TranscriptEvent } from './deepgram-client.js';

export interface UtteranceEvent {
  text: string;
  confidence: number;
}

export class SttSession {
  private finalParts: string[] = [];
  private lastInterim = '';
  private _confidence = 0;
  private _utteranceCount = 0;

  onUtterance: ((event: UtteranceEvent) => void) | null = null;
  onInterim: ((text: string) => void) | null = null;

  /** Process a transcript event from Deepgram */
  processTranscript(event: TranscriptEvent): void {
    if (event.isFinal) {
      // Final transcript for this segment
      if (event.transcript.trim()) {
        this.finalParts.push(event.transcript.trim());
        this._confidence = Math.min(this._confidence || 1, event.confidence);
      }
      this.lastInterim = '';

      // If speech_final, this utterance is complete
      if (event.speechFinal) {
        this.emitUtterance();
      }
    } else {
      // Interim result — update the display but don't accumulate
      this.lastInterim = event.transcript;
      this.onInterim?.(this.getCurrentText());
    }
  }

  /** Force-emit the current accumulated text as an utterance (e.g., on utterance_end) */
  flush(): void {
    if (this.finalParts.length > 0 || this.lastInterim.trim()) {
      this.emitUtterance();
    }
  }

  /** Get the current full text (finals + current interim) */
  getCurrentText(): string {
    const parts = [...this.finalParts];
    if (this.lastInterim.trim()) {
      parts.push(this.lastInterim.trim());
    }
    return parts.join(' ');
  }

  /** Reset state for a new utterance within the same session */
  reset(): void {
    this.finalParts = [];
    this.lastInterim = '';
    this._confidence = 0;
  }

  get utteranceCount(): number {
    return this._utteranceCount;
  }

  private emitUtterance(): void {
    const text = this.finalParts.join(' ').trim();
    if (text) {
      this._utteranceCount++;
      this.onUtterance?.({ text, confidence: this._confidence });
    }
    this.reset();
  }
}
