export interface VoiceServiceConfig {
  bridge: {
    url: string;
    deviceId: string | null;
    token: string | null;
    pairingToken: string;
  };
  device: {
    name: string;
  };
  deepgram: {
    apiKey: string;
    model: string;
    language: string;
    sampleRate: number;
    encoding: string;
    channels: number;
    endpointing: number;
    interimResults: boolean;
    punctuate: boolean;
    smartFormat: boolean;
    vadEvents: boolean;
    utteranceEndMs: number;
  };
  cartesia: {
    apiKey: string;
    voiceId: string;
    modelId: string;
    version: string;
    sampleRate: number;
    encoding: string;
    language: string;
  };
  openclaw: {
    url: string;
    token: string;
  };
  session: {
    commandFollowUpMs: number;
    conversationFollowUpMs: number;
    maxExchanges: number;
    maxSessionDurationMs: number;
  };
  whisper: {
    apiKey: string;
  };
}

export enum SpeechPriority {
  CRITICAL = 0,
  ALERT = 1,
  RESPONSE = 2,
  PROACTIVE = 3,
  AMBIENT = 4,
}

export type SessionState = 'idle' | 'listening' | 'processing' | 'speaking' | 'followup';

export type SessionMode = 'command' | 'conversation' | 'thinking_partner';

export interface SessionExchange {
  role: 'user' | 'jarvis';
  text: string;
  timestamp: number;
  wasInterrupted?: boolean;
  interruptedAtText?: string;
}

export interface VoiceSession {
  sessionId: string;
  deviceId: string;
  state: SessionState;
  mode: SessionMode;
  openedAt: number;
  exchanges: SessionExchange[];
  lastActivityAt: number;
}

export interface SpeechItem {
  text: string;
  audio?: Buffer;
  sessionId: string;
  priority: SpeechPriority;
  sentenceIndex: number;
}

export interface BridgeFrame {
  type: string;
  id: string;
  payload: Record<string, unknown>;
}

// Binary audio frame header layout:
// Bytes 0-35:  sessionId (36-byte ASCII UUID)
// Byte  36:    direction (0x00 = upstream/mic, 0x01 = downstream/tts)
// Bytes 37+:   raw PCM audio data
export const AUDIO_HEADER_LENGTH = 37;
export const DIRECTION_UPSTREAM = 0x00;
export const DIRECTION_DOWNSTREAM = 0x01;
