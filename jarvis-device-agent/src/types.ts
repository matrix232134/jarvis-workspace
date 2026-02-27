import type WebSocket from 'ws';

export type FrameType = 'auth' | 'chat' | 'chat.response' | 'device.command' | 'device.response' | 'error' | 'ping' | 'pong'
  | 'voice.session_start' | 'voice.session_end' | 'voice.speech_end' | 'voice.barge_in'
  | 'voice.transcript' | 'voice.playback_stop' | 'voice.speech_complete' | 'voice.proactive';

export interface BridgeFrame {
  type: FrameType;
  id: string;
  payload: Record<string, unknown>;
}

export interface DeviceAgentConfig {
  bridge: {
    url: string;
    deviceId: string | null;
    token: string | null;
    pairingToken: string;
  };
  device: {
    name: string;
  };
  capabilities: string[];
  security: SecurityConfig;
  voice?: VoiceConfig;
}

export interface VoiceConfig {
  enabled?: boolean;           // default true
  micDeviceName?: string;
  wakeWordThreshold?: number;  // default 0.5
}

export interface SecurityConfig {
  killSwitchEnabled: boolean;
  allowedPaths: string[];
  deniedPaths: string[];
  auditLogPath: string;
  maxScreenshotsPerMinute: number;
  maxInputActionsPerMinute: number;
}

export interface CommandPayload {
  targetDeviceId: string;
  subsystem: string;
  action: string;
  params: Record<string, unknown>;
}

export interface CommandResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export type SubsystemHandler = (action: string, params: Record<string, unknown>) => Promise<CommandResponse>;
