/**
 * Presence Context Engine.
 *
 * Reads session state + clock signals. Outputs voice configuration
 * (Cartesia generation controls) and response timing.
 *
 * Design principle: every output must produce a PERCEPTIBLE difference.
 * If you can't hear it, don't compute it.
 */

import type { SessionMode } from '../types.js';

// ---- Input: 6 signals that actually matter ----

export interface PresenceSignals {
  localHour: number;                      // 0-23, Adelaide time
  isFirstInteractionToday: boolean;       // from GreetingTracker
  sessionMode: SessionMode;               // command | conversation | thinking_partner
  exchangePace: 'rapid' | 'normal' | 'slow';
  isProactiveMessage: boolean;            // JARVIS-initiated speech
  isCrisis: boolean;                      // tier 1 alert
}

// ---- Output: what Cartesia and the orchestrator actually use ----

export type ProfileName =
  | 'default' | 'morning' | 'acknowledge'
  | 'crisis' | 'thinking' | 'late_night' | 'proactive';

export interface VoiceConfig {
  /** Cartesia __experimental_controls.speed: -1.0 to 1.0, 0 = default */
  speed: number;
  /** Cartesia __experimental_controls.emotion: array of "tag: level" strings, or null */
  emotion: string[] | null;
}

export interface PresenceContext {
  profile: ProfileName;
  voice: VoiceConfig;
  responseDelayMs: number;       // deliberate pause before first TTS chunk
  chimeType: 'wake' | 'proactive' | 'none';
  proactiveGapMs: number;        // silence between proactive chime and speech
}

// ---- Voice configs: perceptible differences only ----
// Speed range: -1.0 (slow) to 1.0 (fast). 0 = default.
// At ±0.15 the difference is clearly audible. Below ±0.05 it's inaudible.

const VOICE_CONFIGS: Record<ProfileName, VoiceConfig> = {
  default:     { speed: 0,     emotion: null },
  morning:     { speed: -0.12, emotion: null },                     // unhurried
  acknowledge: { speed: 0.15,  emotion: null },                     // snappy
  crisis:      { speed: -0.10, emotion: ['anger:lowest'] },         // measured authority
  thinking:    { speed: -0.08, emotion: null },                     // room to land
  late_night:  { speed: -0.08, emotion: null },                     // softer pace
  proactive:   { speed: -0.05, emotion: ['curiosity:lowest'] },     // deliberate, slightly inquisitive
};

// ---- Profile selection: priority chain, first match wins ----

export function analyzeContext(signals: PresenceSignals): PresenceContext {
  let profile: ProfileName = 'default';

  if (signals.isCrisis) {
    profile = 'crisis';
  } else if (signals.exchangePace === 'rapid' && signals.sessionMode === 'command') {
    profile = 'acknowledge';
  } else if (signals.isFirstInteractionToday) {
    profile = 'morning';
  } else if (signals.sessionMode === 'thinking_partner') {
    profile = 'thinking';
  } else if (signals.isProactiveMessage) {
    profile = 'proactive';
  } else if (signals.localHour >= 22 || signals.localHour < 5) {
    profile = 'late_night';
  }

  // Response delay: how long JARVIS "considers" before speaking
  // Commands: instant. Complex questions: a beat. Proactive: none (chime handles it).
  let responseDelayMs = 0;
  if (signals.sessionMode === 'thinking_partner') {
    responseDelayMs = 250;   // perceptible "consideration"
  } else if (signals.sessionMode === 'conversation') {
    responseDelayMs = 120;   // slight beat
  }

  // Chime selection
  const chimeType = signals.isProactiveMessage ? 'proactive' as const : 'none' as const;

  return {
    profile,
    voice: VOICE_CONFIGS[profile],
    responseDelayMs,
    chimeType,
    proactiveGapMs: 350,  // silence between proactive chime and speech
  };
}

// ---- Adelaide time helpers ----

export function getAdelaideHour(): number {
  return parseInt(
    new Date().toLocaleString('en-AU', {
      hour: 'numeric', hour12: false, timeZone: 'Australia/Adelaide',
    })
  );
}
