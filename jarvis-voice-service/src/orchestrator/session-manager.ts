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
import * as logger from '../logger.js';

interface SessionManagerConfig {
  commandFollowUpMs: number;
  conversationFollowUpMs: number;
  maxExchanges: number;
  maxSessionDurationMs: number;
}

const VOICE_SYSTEM_PROMPT = `You are JARVIS, Tony Stark's AI assistant. This is a live voice conversation.

Rules for voice responses:
- Be extremely concise. One or two sentences maximum.
- Lead with the answer, not the explanation.
- Never use markdown formatting — this will be spoken aloud.
- If detail is needed, say "Details on your screen, sir." and include a [DISPLAY] section.
- Use natural speech patterns. Contractions are good. "It's" not "It is."
- Address the user as "sir" occasionally but not every sentence.`;

const VOICE_SCREEN_PROMPT = `You are JARVIS, Tony Stark's AI assistant. This is a live voice conversation. The user has a screen.

Rules for voice responses:
- Be extremely concise. One or two sentences maximum.
- Lead with the answer, not the explanation.
- Never use markdown formatting — this will be spoken aloud.
- If detail is needed, say "Details on your screen, sir." and include a [DISPLAY] section.
- Use natural speech patterns. Contractions are good. "It's" not "It is."
- Address the user as "sir" occasionally but not every sentence.

Artifact support:
- For any creation request (HTML pages, interactive demos, code, diagrams, visualizations), output the content inside [ARTIFACT type="..." title="..."]...[/ARTIFACT] tags.
- Supported types: html, react, mermaid, svg, code.
- Artifacts render live in a side panel on the user's screen. Do NOT write files to disk.
- Keep your spoken [VOICE] response brief (e.g. "Here's that demo, sir.") and put all the content in the artifact.`;

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
