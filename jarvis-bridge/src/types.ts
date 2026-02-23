import type WebSocket from 'ws';

export type FrameType = 'auth' | 'chat' | 'chat.response' | 'device.command' | 'device.response' | 'device.list' | 'device.list.response' | 'device.subscribe' | 'device.change' | 'device.capability_change' | 'voice.session_start' | 'voice.session_end' | 'voice.speech_end' | 'voice.barge_in' | 'voice.transcript' | 'voice.playback_stop' | 'voice.speech_complete' | 'voice.proactive' | 'voice.display' | 'voice.artifact' | 'error' | 'ping' | 'pong';

export interface VoiceSessionRecord {
  sessionId: string;
  deviceId: string;
  voiceServiceId: string;
  startedAt: Date;
  state: 'active' | 'ended';
}

export interface BridgeFrame {
  type: FrameType;
  id: string;
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DeviceRecord {
  id: string;
  name: string;
  token: string;
  createdAt: string;
}

export interface ConnectedDevice extends DeviceRecord {
  ws: WebSocket;
  connectedAt: Date;
  capabilities: string[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  capabilities: string[];
  connectedAt: string;
}

export interface BridgeConfig {
  port: number;
  host: string;
  openclaw: {
    url: string;
    token: string;
  };
  bridge: {
    secret: string;
    maxDevices: number;
  };
}
