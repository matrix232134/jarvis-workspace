/**
 * Speculative acknowledgment — Tier 1 only.
 *
 * Fires ONLY when:
 * 1. Transcript exactly matches a known confirmation phrase
 * 2. Session buffer shows JARVIS just proposed an action or asked yes/no
 * 3. STT confidence > 0.90
 *
 * Returns cached audio for instant playback (~50ms).
 */

import type { PhraseCache } from '../tts/phrase-cache.js';
import type { VoiceSession } from '../types.js';

// Tier 1 phrases — exhaustive list. These MUST be dead-certain confirmations.
const TIER1_PATTERNS: Array<{ match: RegExp; response: string }> = [
  { match: /^(yes|yeah|yep)\.?$/i, response: 'Will do, sir.' },
  { match: /^do it\.?$/i, response: 'Right away, sir.' },
  { match: /^go ahead\.?$/i, response: 'On it, sir.' },
  { match: /^proceed\.?$/i, response: 'Will do, sir.' },
  { match: /^confirmed\.?$/i, response: 'Understood.' },
  { match: /^affirmative\.?$/i, response: 'Will do, sir.' },
  { match: /^make it so\.?$/i, response: 'As you wish.' },
  { match: /^go for it\.?$/i, response: 'On it, sir.' },
];

const MIN_CONFIDENCE = 0.85;

export class SpeculativeAck {
  private phraseCache: PhraseCache;

  constructor(phraseCache: PhraseCache) {
    this.phraseCache = phraseCache;
  }

  /**
   * Check if the utterance qualifies for a speculative acknowledgment.
   * Returns cached audio buffer if conditions are met, null otherwise.
   */
  check(
    utterance: string,
    confidence: number,
    session: VoiceSession,
  ): Buffer | null {
    // Condition 1: confidence threshold
    if (confidence < MIN_CONFIDENCE) return null;

    // Condition 2: session context — JARVIS must have just proposed something
    if (!this.sessionImpliesConfirmation(session)) return null;

    // Condition 3: exact pattern match
    const trimmed = utterance.trim();
    for (const pattern of TIER1_PATTERNS) {
      if (pattern.match.test(trimmed)) {
        const audio = this.phraseCache.get(pattern.response);
        if (audio) return audio;
      }
    }

    return null;
  }

  /**
   * Check if the last JARVIS exchange implies it was awaiting confirmation.
   * Heuristic: looks for question marks, "shall I", "should I", "want me to", etc.
   */
  private sessionImpliesConfirmation(session: VoiceSession): boolean {
    const exchanges = session.exchanges;
    if (exchanges.length === 0) return false;

    // Find last JARVIS exchange
    for (let i = exchanges.length - 1; i >= 0; i--) {
      if (exchanges[i].role === 'jarvis') {
        const text = exchanges[i].text.toLowerCase();
        return (
          text.includes('?') ||
          text.includes('shall i') ||
          text.includes('should i') ||
          text.includes('want me to') ||
          text.includes('would you like') ||
          text.includes('go ahead') ||
          text.includes('ready to') ||
          text.includes('proceed')
        );
      }
    }

    return false;
  }
}
