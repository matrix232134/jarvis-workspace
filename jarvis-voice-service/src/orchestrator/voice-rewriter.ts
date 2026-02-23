/**
 * Voice Rewriter — deterministic string replacement for voice-only mode.
 *
 * When no screen device is connected, the LLM may still include phrases like
 * "Details on your screen, sir." in the [VOICE] section. This module rewrites
 * those references to something that makes sense in a voice-only context.
 *
 * Simple string replacement — no LLM re-prompting.
 */

const REWRITES: Array<{ pattern: string; replacement: string }> = [
  {
    pattern: 'Details on your screen, sir.',
    replacement: "I have those details ready when you're at your screen, sir.",
  },
  {
    pattern: 'Details on your screen.',
    replacement: "I have those details ready when you're at your screen.",
  },
  {
    pattern: 'Check your screen, sir.',
    replacement: "I'll have that on your screen when you're back, sir.",
  },
  {
    pattern: "I've put that on your screen, sir.",
    replacement: 'I have that ready for your screen, sir.',
  },
  {
    pattern: "I've put that on your screen.",
    replacement: 'I have that ready for your screen.',
  },
  {
    pattern: 'on your screen',
    replacement: 'ready for your screen when you return',
  },
];

/**
 * Rewrite voice text for voice-only mode.
 * Applies the most specific match first (longer patterns checked first).
 * Returns the text with substitutions applied.
 */
export function rewriteForVoiceOnly(voiceText: string): string {
  let result = voiceText;
  for (const { pattern, replacement } of REWRITES) {
    if (result.includes(pattern)) {
      result = result.replace(pattern, replacement);
      // Only apply the first matching rewrite to avoid double-substitution
      break;
    }
  }
  return result;
}
