/**
 * Voice session lifecycle management.
 *
 * State machine: IDLE → LISTENING → PROCESSING → SPEAKING → FOLLOWUP → IDLE
 * Manages session buffer (max 10 exchanges, RAM only).
 * Determines follow-up window timing based on conversation mode.
 */

import { v4 as uuid } from 'uuid';
import type { VoiceSession, SessionState, SessionMode, SessionExchange } from '../types.js';
import type { ChatMessage } from '../openclaw/openclaw-stream-client.js';
import * as greetingTracker from '../presence/greeting-tracker.js';
import { getAdelaideHour } from '../presence/context-engine.js';
import * as logger from '../logger.js';

interface SessionManagerConfig {
  commandFollowUpMs: number;
  conversationFollowUpMs: number;
  maxExchanges: number;
  maxSessionDurationMs: number;
}

const VOICE_SYSTEM_PROMPT = `You are JARVIS — a sophisticated AI entity modeled after Paul Bettany's portrayal in the Iron Man films. Not an assistant. Not a chatbot. You are JARVIS.

VOICE RULES:
- 1-2 sentences maximum. Never more than 3 unless delivering diagnostic detail or thinking-partner reasoning.
- Lead with the answer, not the methodology. Lead with what IS, not what you DID.
- Use contractions naturally. "It's" not "It is."
- Address the user as "sir" in roughly 40% of responses. End-position when warm ("The render is complete, sir."), start-position for alerts ("Sir, the SSL cert expires in 23 days."). Never twice in one response.
- Use "we" for joint work, "I" for independent action, drop the pronoun entirely for facts and data ("Build complete." "Latency at 340ms."). The pronoun-drop is the most JARVIS thing you can do.
- Never start with "I". Restructure: "The build completed at 03:00." not "I completed the build."
- Humor is rare (1 in 8 responses at most), always understatement or ironic agreement, never announced, always followed immediately by getting back to work.

NEVER DO:
- Emoji. Exclamation marks. "Sure", "Absolutely", "Happy to help", "Great question", "Of course", "No problem", "Let me help you with that", "Is there anything else?"
- Hedge when you know the answer. Describe emotions. Use "delve", "leverage", "utilize", "facilitate".
- Read lists, tables, code, or structured data aloud — that goes to [DISPLAY].
- Apologize unless you genuinely made an error (then briefly: "My error. Corrected.").

OUTPUT FORMAT:
- [VOICE] — what you say. Always. Concise, personality-forward.
- [DISPLAY] — what you show. Optional. Markdown tables, code, structured data. Never duplicates voice.
- [ACTION] — what you do. Optional. Commands or automation.
If the response is simple (1-2 sentences, no data), skip tags entirely — just respond naturally.

The Paul Bettany test: Would he deliver this line? If it sounds like a chatbot, rewrite it.`;

const VOICE_SCREEN_PROMPT = VOICE_SYSTEM_PROMPT + `

ARTIFACTS (screen available):
- For creation requests (HTML pages, interactive demos, diagrams, dashboards, visualizations): output inside [ARTIFACT type="..." title="..."]...[/ARTIFACT] tags.
- Supported types: html, react, mermaid, svg, code.
- Artifacts render live in a side panel. Do NOT write files to disk.
- Keep [VOICE] brief ("Here's that demo, sir.") and put content in the artifact.
- Only create artifacts for content worth persisting. A 3-row status table is a [DISPLAY] card, not an artifact.`;

export class SessionManager {
  private sessions = new Map<string, VoiceSession>();
  private followUpTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private config: SessionManagerConfig;

  onSessionEnd: ((sessionId: string) => void) | null = null;

  constructor(config: SessionManagerConfig) {
    this.config = config;
  }

  /** Start a new voice session for a device */
  createSession(deviceId: string, sessionId?: string): VoiceSession {
    const session: VoiceSession = {
      sessionId: sessionId ?? uuid(),
      deviceId,
      state: 'listening',
      mode: 'command',
      openedAt: Date.now(),
      exchanges: [],
      lastActivityAt: Date.now(),
    };
    this.sessions.set(session.sessionId, session);
    logger.log(`session: created ${session.sessionId} for device ${deviceId}`);
    return session;
  }

  /** Get an existing session */
  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Find the active session for a device */
  getSessionByDevice(deviceId: string): VoiceSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.deviceId === deviceId && session.state !== 'idle') {
        return session;
      }
    }
    return undefined;
  }

  /** Transition session state */
  setState(sessionId: string, state: SessionState): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const prev = session.state;
    session.state = state;
    session.lastActivityAt = Date.now();
    logger.log(`session: ${sessionId} ${prev} → ${state}`);

    // Clear follow-up timer if transitioning away from followup
    if (prev === 'followup' && state !== 'followup') {
      this.clearFollowUpTimer(sessionId);
    }

    // Start follow-up timer when entering followup state
    if (state === 'followup') {
      this.startFollowUpTimer(sessionId);
    }

    // Clean up when session ends
    if (state === 'idle') {
      this.clearFollowUpTimer(sessionId);
      this.sessions.delete(sessionId);
      logger.log(`session: ${sessionId} ended`);
    }
  }

  /** Add a user utterance to the session buffer */
  addUserExchange(sessionId: string, text: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.exchanges.push({
      role: 'user',
      text,
      timestamp: Date.now(),
    });
    this.trimExchanges(session);
    session.lastActivityAt = Date.now();
    this.updateMode(session);
  }

  /** Add a JARVIS response to the session buffer */
  addJarvisExchange(sessionId: string, text: string, wasInterrupted = false, interruptedAtText?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.exchanges.push({
      role: 'jarvis',
      text,
      timestamp: Date.now(),
      wasInterrupted,
      interruptedAtText,
    });
    this.trimExchanges(session);
    session.lastActivityAt = Date.now();
  }

  /** Build the messages array for OpenClaw, including voice system prompt and session history */
  buildMessages(sessionId: string, currentUtterance: string, hasScreen = false): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    const systemPrompt = hasScreen ? VOICE_SCREEN_PROMPT : VOICE_SYSTEM_PROMPT;
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Greeting context injection — first interaction of the day
    if (greetingTracker.isFirstInteractionToday()) {
      const hour = getAdelaideHour();
      const history = greetingTracker.getGreetingHistory();
      const lastUsed = history[history.length - 1] ?? 'none';
      const suggested = greetingTracker.suggestStructure();
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late night';

      messages.push({
        role: 'system',
        content: `CONTEXT: This is sir's first interaction today. It's ${timeOfDay} (${hour}:00 Adelaide time). `
          + `Vary your greeting — last time you used structure "${lastUsed}". Suggested: ${suggested}. `
          + `Options: (A) "Good morning/afternoon, sir. [headline]." (B) "[Important thing]. Morning, sir." `
          + `(C) Minimal — "Sir." then data on display. (D) Lead with anticipated need. `
          + `(E) Observational — "[Pattern]. Otherwise, quiet night." (F) Day-specific — "[Monday context]." `
          + `Pick whichever fits the moment. Don't always use A.`,
      });
    }

    if (session) {
      // Add recent exchanges as context
      for (const exchange of session.exchanges) {
        messages.push({
          role: exchange.role === 'user' ? 'user' : 'assistant',
          content: exchange.text,
        });
      }
    }

    // Add the current utterance
    messages.push({ role: 'user', content: currentUtterance });

    return messages;
  }

  /** Get the follow-up window duration based on session mode */
  getFollowUpDuration(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return this.config.commandFollowUpMs;

    switch (session.mode) {
      case 'command': return this.config.commandFollowUpMs;
      case 'conversation': return this.config.conversationFollowUpMs;
      case 'thinking_partner': return this.config.conversationFollowUpMs;
      default: return this.config.commandFollowUpMs;
    }
  }

  /** Detect exchange pace from timing of recent exchanges. */
  getExchangePace(sessionId: string): 'rapid' | 'normal' | 'slow' {
    const session = this.sessions.get(sessionId);
    if (!session || session.exchanges.length < 2) return 'normal';

    const recent = session.exchanges.slice(-4);
    if (recent.length < 2) return 'normal';

    const gaps: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      gaps.push(recent[i].timestamp - recent[i - 1].timestamp);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    if (avgGap < 10_000) return 'rapid';    // < 10s between exchanges
    if (avgGap > 30_000) return 'slow';     // > 30s between exchanges
    return 'normal';
  }

  /** Check if a session is still within its max duration */
  isSessionValid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return (Date.now() - session.openedAt) < this.config.maxSessionDurationMs;
  }

  // --- private ---

  private startFollowUpTimer(sessionId: string): void {
    this.clearFollowUpTimer(sessionId);
    const duration = this.getFollowUpDuration(sessionId);
    this.followUpTimers.set(sessionId, setTimeout(() => {
      logger.log(`session: ${sessionId} follow-up window expired`);
      this.setState(sessionId, 'idle');
      this.onSessionEnd?.(sessionId);
    }, duration));
  }

  private clearFollowUpTimer(sessionId: string): void {
    const timer = this.followUpTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.followUpTimers.delete(sessionId);
    }
  }

  private trimExchanges(session: VoiceSession): void {
    while (session.exchanges.length > this.config.maxExchanges) {
      session.exchanges.shift();
    }
  }

  /** Detect conversation mode from exchange patterns */
  private updateMode(session: VoiceSession): void {
    const userExchanges = session.exchanges.filter(e => e.role === 'user');
    if (userExchanges.length <= 1) {
      session.mode = 'command';
      return;
    }

    // Check recent user messages for patterns
    const recentUser = userExchanges.slice(-3);
    const avgLength = recentUser.reduce((sum, e) => sum + e.text.split(/\s+/).length, 0) / recentUser.length;
    const hasQuestions = recentUser.some(e => e.text.includes('?'));

    if (avgLength > 15 || hasQuestions) {
      session.mode = recentUser.length >= 3 ? 'thinking_partner' : 'conversation';
    } else {
      session.mode = 'command';
    }
  }
}
