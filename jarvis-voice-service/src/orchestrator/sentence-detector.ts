/**
 * Accumulates streaming LLM tokens and detects sentence boundaries.
 * Emits complete sentences as soon as they're detected, enabling
 * parallel TTS dispatch without waiting for the full LLM response.
 */

// Titles/abbreviations that end with period but aren't sentence endings
const NON_BOUNDARY_WORDS = new Set([
  'dr.', 'mr.', 'mrs.', 'ms.', 'jr.', 'sr.', 'prof.',
  'inc.', 'ltd.', 'corp.', 'co.', 'vs.', 'etc.', 'approx.',
  'st.', 'ave.', 'blvd.', 'e.g.', 'i.e.', 'a.m.', 'p.m.',
]);

export class SentenceDetector {
  private buffer = '';

  /**
   * Add a token from the LLM stream.
   * Returns a complete sentence if a boundary was detected, or null.
   */
  addToken(token: string): string | null {
    this.buffer += token;

    // Look for sentence boundaries: . ! ? followed by whitespace or end
    // We check after adding each token to catch boundaries mid-token
    const match = this.buffer.match(/^(.*?[.!?])\s+(.*)/s);
    if (!match) return null;

    const candidate = match[1].trim();
    const remainder = match[2];

    // Check if the period is part of an abbreviation
    const lastWord = this.getLastWord(candidate).toLowerCase();
    if (NON_BOUNDARY_WORDS.has(lastWord)) {
      return null;
    }

    // Check for decimal numbers (e.g., "3.14")
    if (/\d\.\d/.test(candidate.slice(-4))) {
      return null;
    }

    // Check for abbreviations like "U.S." (alternating letter-dot)
    if (/[A-Za-z]\.[A-Za-z]\.?$/.test(candidate.slice(-5))) {
      return null;
    }

    // Boundary confirmed
    this.buffer = remainder;
    return candidate;
  }

  /** Flush any remaining text as the final "sentence" */
  flush(): string | null {
    const text = this.buffer.trim();
    this.buffer = '';
    return text || null;
  }

  /** Reset the detector */
  reset(): void {
    this.buffer = '';
  }

  private getLastWord(text: string): string {
    const words = text.split(/\s+/);
    return words[words.length - 1] ?? '';
  }
}
