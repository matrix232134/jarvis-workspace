/**
 * Greeting Tracker — persists greeting variation state.
 *
 * Ensures JARVIS never opens the same way twice in a row.
 * State survives service restarts via JSON file.
 * Accessible to OpenClaw via the notification API GET /presence endpoint
 * so Telegram greetings can also vary.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', '..');
const STATE_PATH = join(STATE_DIR, 'presence-state.json');
const MAX_HISTORY = 5;

// Greeting structures (A-F) defined in AGENTS.md
export const GREETING_STRUCTURES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type GreetingStructure = typeof GREETING_STRUCTURES[number];

interface PresenceState {
  greetingHistory: string[];         // last N structures used
  lastInteractionDate: string | null; // 'YYYY-MM-DD' Adelaide time
  lastGreetingDate: string | null;    // 'YYYY-MM-DD' — distinct from interaction
}

let state: PresenceState = {
  greetingHistory: [],
  lastInteractionDate: null,
  lastGreetingDate: null,
};

export function loadState(): void {
  try {
    state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    state = { greetingHistory: [], lastInteractionDate: null, lastGreetingDate: null };
  }
}

function saveState(): void {
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch { /* non-fatal — state is in-memory anyway */ }
}

/** Record which greeting structure was used. */
export function trackGreeting(structure: string): void {
  state.greetingHistory.push(structure);
  if (state.greetingHistory.length > MAX_HISTORY) state.greetingHistory.shift();
  state.lastGreetingDate = getAdelaideDate();
  saveState();
}

/** Get recent greeting history for variation logic. */
export function getGreetingHistory(): string[] {
  return [...state.greetingHistory];
}

/** Suggest which greeting structure to use next. Picks least-recently-used. */
export function suggestStructure(): GreetingStructure {
  const counts: Record<string, number> = {};
  GREETING_STRUCTURES.forEach(s => { counts[s] = 0; });
  state.greetingHistory.forEach(s => { counts[s] = (counts[s] ?? 0) + 1; });

  const lastUsed = state.greetingHistory[state.greetingHistory.length - 1];

  // Filter out the last-used structure, then pick the one with lowest count
  return GREETING_STRUCTURES
    .filter(s => s !== lastUsed)
    .reduce((a, b) => (counts[a] ?? 0) <= (counts[b] ?? 0) ? a : b);
}

/** Check if this is the first interaction today (Adelaide timezone). */
export function isFirstInteractionToday(): boolean {
  return state.lastInteractionDate !== getAdelaideDate();
}

/** Check if we already greeted today (prevents double-greeting on reconnect). */
export function hasGreetedToday(): boolean {
  return state.lastGreetingDate === getAdelaideDate();
}

/** Mark that an interaction occurred today. */
export function markInteraction(): void {
  state.lastInteractionDate = getAdelaideDate();
  saveState();
}

/** Export full state for the notification API /presence endpoint. */
export function getExternalState(): Record<string, unknown> {
  return {
    lastInteractionDate: state.lastInteractionDate,
    lastGreetingDate: state.lastGreetingDate,
    greetingHistory: [...state.greetingHistory],
    suggestedNextStructure: suggestStructure(),
    isFirstInteractionToday: isFirstInteractionToday(),
  };
}

function getAdelaideDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
}
