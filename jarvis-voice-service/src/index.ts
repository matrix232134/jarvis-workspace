/**
 * JARVIS Voice Service — main entry point.
 *
 * Connects to jarvis-bridge as a device, initializes STT/TTS engines,
 * and orchestrates the full voice pipeline.
 */

import { loadConfig, getConfig, saveConfig } from './config.js';
import { VoiceBridgeClient } from './bridge-client.js';
import { CartesiaClient } from './tts/cartesia-client.js';
import { PhraseCache } from './tts/phrase-cache.js';
import { SpeechPriorityQueue } from './tts/priority-queue.js';
import { DeepgramClient } from './stt/deepgram-client.js';
import { SttSession } from './stt/stt-session.js';
import { OpenClawStreamClient } from './openclaw/openclaw-stream-client.js';
import { SessionManager } from './orchestrator/session-manager.js';
import { SpeculativeAck } from './orchestrator/speculative-ack.js';
import { StreamingOrchestrator, type AudioEmission } from './orchestrator/streaming-orchestrator.js';
import { DisplayQueue } from './orchestrator/display-queue.js';
import { prepareForTTS } from './tts/text-prep.js';
import * as greetingTracker from './presence/greeting-tracker.js';
import { analyzeContext, getAdelaideHour } from './presence/context-engine.js';
import type { BridgeFrame, VoiceSession } from './types.js';
import * as logger from './logger.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

async function main(): Promise<void> {
  logger.log('JARVIS Voice Service starting...');
  const config = loadConfig();

  // --- Initialize presence state ---
  greetingTracker.loadState();

  // --- Validate bridge credentials ---
  if (!config.bridge.deviceId || !config.bridge.token) {
    logger.log('No bridge credentials — will attempt pairing on first connect.');
  }

  // --- Initialize Cartesia TTS ---
  const cartesia = new CartesiaClient({
    apiKey: config.cartesia.apiKey,
    voiceId: config.cartesia.voiceId,
    modelId: config.cartesia.modelId,
    version: config.cartesia.version,
    sampleRate: config.cartesia.sampleRate,
    encoding: config.cartesia.encoding,
    language: config.cartesia.language,
  });
  cartesia.connect();

  // Wait for Cartesia to connect before warming cache
  await waitForConnection('Cartesia', () => cartesia.isConnected(), 10_000);

  // --- Warm phrase cache ---
  const phraseCache = new PhraseCache();
  await phraseCache.warmup(cartesia);

  // --- Initialize Deepgram STT ---
  const deepgram = new DeepgramClient({
    apiKey: config.deepgram.apiKey,
    model: config.deepgram.model,
    language: config.deepgram.language,
    sampleRate: config.deepgram.sampleRate,
    encoding: config.deepgram.encoding,
    channels: config.deepgram.channels,
    endpointing: config.deepgram.endpointing,
    interimResults: config.deepgram.interimResults,
    punctuate: config.deepgram.punctuate,
    smartFormat: config.deepgram.smartFormat,
    vadEvents: config.deepgram.vadEvents,
    utteranceEndMs: config.deepgram.utteranceEndMs,
  });
  deepgram.connect();

  // --- Initialize OpenClaw streaming client ---
  const openclawClient = new OpenClawStreamClient({
    url: config.openclaw.url,
    token: config.openclaw.token,
  });

  // --- Initialize session management ---
  const sessionManager = new SessionManager({
    commandFollowUpMs: config.session.commandFollowUpMs,
    conversationFollowUpMs: config.session.conversationFollowUpMs,
    maxExchanges: config.session.maxExchanges,
    maxSessionDurationMs: config.session.maxSessionDurationMs,
  });

  const speculativeAck = new SpeculativeAck(phraseCache);
  const priorityQueue = new SpeechPriorityQueue();

  // --- Initialize streaming orchestrator ---
  const orchestrator = new StreamingOrchestrator({
    sessionManager,
    speculativeAck,
    cartesia,
    phraseCache,
    openclawClient,
    priorityQueue,
  });

  // --- Display queue and screen tracking ---
  const displayQueue = new DisplayQueue();
  let hasScreenDevice = false;
  let lastScreenDeviceId: string | null = null;

  // --- Per-session STT instances ---
  const sttSessions = new Map<string, SttSession>();

  // --- Connect to bridge ---
  const bridgeDeviceId = config.bridge.deviceId ?? 'voice-service-temp';
  const bridgeToken = config.bridge.token ?? '';

  const bridge = new VoiceBridgeClient({
    url: config.bridge.url,
    deviceId: bridgeDeviceId,
    token: bridgeToken,
  });

  // --- Audio emission → bridge routing ---
  orchestrator.on('audio', (emission: AudioEmission) => {
    if (emission.audio.length > 0) {
      bridge.sendAudio(emission.sessionId, emission.audio);
    }
  });

  orchestrator.on('speaking_done', ({ sessionId }: { sessionId: string }) => {
    // Send the response text so the UI can display it in the chat
    const fullResponse = orchestrator.getFullResponse(sessionId);
    bridge.sendFrame({
      type: 'voice.speech_complete',
      id: '',
      payload: { sessionId, responseText: fullResponse ?? undefined },
    });
  });

  orchestrator.on('barge_in', ({ sessionId }: { sessionId: string }) => {
    // Notify the device to stop playback
    bridge.sendFrame({
      type: 'voice.playback_stop',
      id: '',
      payload: { sessionId },
    });
  });

  // --- Artifact content routing ---
  orchestrator.on('artifact', ({ sessionId, content, meta }: { sessionId: string; content: string; meta: { type: string; title: string; language?: string } }) => {
    bridge.sendFrame({
      type: 'voice.artifact' as any,
      id: '',
      payload: { sessionId, content, type: meta.type, title: meta.title, language: meta.language },
    });
    logger.log(`voice: artifact sent (type: ${meta.type}, title: ${meta.title})`);
  });

  // --- Display content routing ---
  orchestrator.on('display', ({ sessionId, content }: { sessionId: string; content: string }) => {
    if (hasScreenDevice) {
      bridge.sendFrame({
        type: 'voice.display',
        id: '',
        payload: { sessionId, content },
      });
      logger.log(`voice: display content sent to screen device`);
    } else {
      displayQueue.enqueue(sessionId, content);
      logger.log(`voice: display content queued (queue size: ${displayQueue.size})`);
    }
  });

  // --- Session end notification to device ---
  sessionManager.onSessionEnd = (sessionId: string) => {
    bridge.sendFrame({
      type: 'voice.session_end',
      id: '',
      payload: { sessionId, reason: 'timeout' },
    });
    sttSessions.delete(sessionId);
  };

  // --- Bridge control frame handling ---
  bridge.onFrame = (frame: BridgeFrame) => {
    if (frame.type === 'voice.session_start') {
      handleSessionStart(frame);
    } else if (frame.type === 'voice.barge_in') {
      handleBargeIn(frame);
    } else if (frame.type === 'voice.session_end') {
      handleSessionEnd(frame);
    } else if (frame.type === 'voice.speech_end') {
      handleSpeechEnd(frame);
    } else if (frame.type === 'device.capability_change') {
      handleCapabilityChange(frame);
    }
  };

  // --- Bridge audio handling (upstream mic audio from devices) ---
  bridge.onAudio = (sessionId: string, audio: Buffer) => {
    // Route mic audio to Deepgram for STT
    deepgram.sendAudio(audio);
  };

  // --- Deepgram transcript handling ---
  deepgram.onTranscript = (event) => {
    // Find the active session (for now, single-session)
    // TODO: multi-session support with per-session Deepgram connections
    for (const [sessionId, sttSession] of sttSessions) {
      sttSession.processTranscript(event);
    }
  };

  deepgram.onUtteranceEnd = () => {
    // Flush any accumulated text
    for (const [sessionId, sttSession] of sttSessions) {
      sttSession.flush();
    }
  };

  function handleSessionStart(frame: BridgeFrame): void {
    const deviceId = frame.payload.deviceId as string;
    const sessionId = frame.payload.sessionId as string;
    const text = frame.payload.text as string | undefined;

    if (!deviceId || !sessionId) {
      logger.warn('voice: session_start missing deviceId or sessionId');
      return;
    }

    // Use the device's sessionId so bridge audio routing matches
    const session = sessionManager.createSession(deviceId, sessionId);

    // Acknowledge session to device
    bridge.sendFrame({
      type: 'voice.session_start',
      id: frame.id,
      payload: { sessionId, success: true },
    });

    if (text) {
      // Text input mode — skip STT, go straight to TTS
      logger.log(`voice: text-to-speech session ${sessionId} for device ${deviceId}: "${text.substring(0, 60)}..."`);
      synthesizeText(sessionId, text);
    } else {
      // Normal voice mode — set up STT
      const sttSession = new SttSession();
      sttSession.onUtterance = (event) => {
        logger.log(`STT: "${event.text}" (confidence: ${event.confidence.toFixed(2)})`);
        // Send final transcript so UI can display the user's speech in chat
        bridge.sendFrame({
          type: 'voice.transcript',
          id: '',
          payload: { sessionId, text: event.text, isFinal: true },
        });
        orchestrator.processUtterance(sessionId, event.text, event.confidence, hasScreenDevice);
      };
      sttSession.onInterim = (text) => {
        // Send interim transcript to device for display
        bridge.sendFrame({
          type: 'voice.transcript',
          id: '',
          payload: { sessionId, text, isFinal: false },
        });
      };
      sttSessions.set(sessionId, sttSession);
      logger.log(`voice: session started for device ${deviceId} → ${sessionId}`);
    }
  }

  async function synthesizeText(sessionId: string, text: string): Promise<void> {
    try {
      const sentences = prepareForTTS(text);

      // Determine voice controls from presence context
      const presenceCtx = analyzeContext({
        localHour: getAdelaideHour(),
        isFirstInteractionToday: greetingTracker.isFirstInteractionToday(),
        sessionMode: 'command',
        exchangePace: 'normal',
        isProactiveMessage: false,
        isCrisis: false,
      });
      const controls = { speed: presenceCtx.voice.speed, emotion: presenceCtx.voice.emotion };

      // Fire all TTS requests in parallel, collect audio in order
      const audioPromises = sentences.map(async (sentence, index) => {
        const cached = phraseCache.get(sentence);
        if (cached) return { index, audio: cached };

        const chunks: Buffer[] = [];
        await cartesia.synthesize(sentence, `${sessionId}-tts-${index}`, (chunk) => {
          chunks.push(chunk);
        }, controls);
        return { index, audio: Buffer.concat(chunks) };
      });

      const results = await Promise.all(audioPromises);

      // Send audio in sentence order
      results.sort((a, b) => a.index - b.index);
      for (const result of results) {
        bridge.sendAudio(sessionId, result.audio);
      }

      // Signal speech complete immediately (audio already sent)
      bridge.sendFrame({
        type: 'voice.speech_complete',
        id: '',
        payload: { sessionId },
      });
    } catch (err) {
      logger.error(`voice: synthesizeText failed for session ${sessionId}: ${err}`);
      bridge.sendFrame({
        type: 'voice.speech_complete',
        id: '',
        payload: { sessionId },
      });
    }
  }

  function handleBargeIn(frame: BridgeFrame): void {
    const sessionId = frame.payload.sessionId as string;
    const keyword = (frame.payload.keyword as string) ?? 'stop';
    orchestrator.handleBargeIn(sessionId, keyword);
  }

  function handleSessionEnd(frame: BridgeFrame): void {
    const sessionId = frame.payload.sessionId as string;
    if (sessionId) {
      orchestrator.cancelSession(sessionId);
      sessionManager.setState(sessionId, 'idle');
      sttSessions.delete(sessionId);
      logger.log(`voice: session ${sessionId} ended by device`);
    }
  }

  function handleSpeechEnd(frame: BridgeFrame): void {
    const sessionId = frame.payload.sessionId as string;
    // User finished speaking — flush STT
    const sttSession = sttSessions.get(sessionId);
    if (sttSession) {
      sttSession.flush();
    }
  }

  // --- Screen device capability tracking ---
  function handleCapabilityChange(frame: BridgeFrame): void {
    const newHasScreen = !!frame.payload.hasScreenDevice;
    const eventDeviceId = frame.payload.deviceId as string;
    const event = frame.payload.event as string;  // 'connected' | 'disconnected'
    const wasScreenAvailable = hasScreenDevice;

    hasScreenDevice = newHasScreen;
    logger.log(`voice: screen device ${hasScreenDevice ? 'available' : 'unavailable'}`);

    if (hasScreenDevice && eventDeviceId) {
      lastScreenDeviceId = eventDeviceId;
    }

    // Flush queued displays when screen becomes available
    if (!wasScreenAvailable && hasScreenDevice && displayQueue.size > 0) {
      flushDisplayQueue();
    }

    // === AUTO-GREETING: JARVIS notices you arrived ===
    if (event === 'connected' && hasScreenDevice && lastScreenDeviceId) {
      if (!greetingTracker.hasGreetedToday()) {
        autoGreet(lastScreenDeviceId);
      }
    }
  }

  async function autoGreet(targetDeviceId: string): Promise<void> {
    const hour = getAdelaideHour();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    const suggested = greetingTracker.suggestStructure();
    const queuedCount = displayQueue.size;

    let greetingText: string;

    if (queuedCount > 0) {
      // Items waiting — mention them
      greetingText = queuedCount === 1
        ? `Good ${timeOfDay}, sir. One item while you were away.`
        : `Good ${timeOfDay}, sir. ${queuedCount} items while you were away.`;
    } else if (suggested === 'C') {
      greetingText = 'Sir.';
    } else if (suggested === 'E') {
      greetingText = `Quiet ${timeOfDay === 'morning' ? 'night' : 'stretch'}, sir. Systems nominal.`;
    } else {
      greetingText = `Good ${timeOfDay}, sir.`;
    }

    logger.log(`voice: auto-greeting → "${greetingText}" (structure: ${suggested})`);
    greetingTracker.trackGreeting(suggested);
    greetingTracker.markInteraction();

    // Small delay — let the UI finish connecting before speaking
    await new Promise(r => setTimeout(r, 800));

    await speakProactive(targetDeviceId, greetingText);
  }

  async function flushDisplayQueue(): Promise<void> {
    const items = displayQueue.drain();
    if (items.length === 0) return;

    logger.log(`voice: flushing ${items.length} queued display item(s) to screen`);

    // Announce via proactive speech
    const announcementText = items.length === 1
      ? 'You have one item from while you were away, sir.'
      : `You have ${items.length} items from while you were away, sir.`;

    if (lastScreenDeviceId) {
      await speakProactive(lastScreenDeviceId, announcementText);
    }

    // Stagger display frames (800ms apart, not all at once)
    for (let i = 0; i < items.length; i++) {
      setTimeout(() => {
        bridge.sendFrame({
          type: 'voice.display',
          id: '',
          payload: {
            sessionId: items[i].sessionId,
            content: items[i].content,
            queued: true,
            queuedAt: items[i].queuedAt,
          },
        });
      }, i * 800);
    }
  }

  // --- Proactive speech (JARVIS-initiated) ---
  async function speakProactive(targetDeviceId: string, text: string): Promise<void> {
    const { v4: proactiveUuid } = await import('uuid');
    const proactiveSessionId = proactiveUuid();

    logger.log(`voice: proactive speech to ${targetDeviceId}: "${text}"`);

    // Notify device to play proactive chime and prepare for audio
    bridge.sendFrame({
      type: 'voice.proactive',
      id: '',
      payload: { targetDeviceId, sessionId: proactiveSessionId, text },
    });

    // Ceremony: chime → deliberate silence → speech
    await new Promise(r => setTimeout(r, 450));

    // Check phrase cache first
    const cached = phraseCache.get(text);
    if (cached) {
      bridge.sendAudio(proactiveSessionId, cached);
      // Signal speech complete after playback duration (no extra padding)
      const playbackMs = (cached.length / 2 / 24000) * 1000;
      setTimeout(() => {
        bridge.sendFrame({
          type: 'voice.speech_complete',
          id: '',
          payload: { sessionId: proactiveSessionId },
        });
      }, playbackMs);
      return;
    }

    // Synthesize via Cartesia with proactive voice profile
    const proactiveCtx = analyzeContext({
      localHour: getAdelaideHour(),
      isFirstInteractionToday: greetingTracker.isFirstInteractionToday(),
      sessionMode: 'command',
      exchangePace: 'normal',
      isProactiveMessage: true,
      isCrisis: false,
    });
    const proactiveControls = { speed: proactiveCtx.voice.speed, emotion: proactiveCtx.voice.emotion };

    const { prepareForTTS } = await import('./tts/text-prep.js');
    const sentences = prepareForTTS(text);
    for (const sentence of sentences) {
      await cartesia.synthesize(sentence, proactiveSessionId, (chunk) => {
        bridge.sendAudio(proactiveSessionId, chunk);
      }, proactiveControls);
    }

    // Signal speech complete immediately (audio already sent)
    bridge.sendFrame({
      type: 'voice.speech_complete',
      id: '',
      payload: { sessionId: proactiveSessionId },
    });
  }

  // Expose proactive speech for external use (e.g., heartbeat alerts)
  (globalThis as any).__jarvisProactiveSpeech = speakProactive;

  // --- Proactive speech API (for heartbeat / external callers) ---
  const speakApi = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS for local tools
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const json = (code: number, data: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // POST /speak — make JARVIS say something out loud
    if (req.method === 'POST' && req.url === '/speak') {
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', async () => {
        try {
          const { text } = JSON.parse(body);
          if (!text) {
            json(400, { delivered: false, reason: 'no_text' });
            return;
          }
          if (!lastScreenDeviceId) {
            json(200, { delivered: false, reason: 'no_device' });
            return;
          }
          await speakProactive(lastScreenDeviceId, text);
          json(200, { delivered: true });
        } catch (err) {
          logger.error(`speak API error: ${err}`);
          json(500, { delivered: false, reason: 'error' });
        }
      });
      return;
    }

    // GET /status — check if a device is connected
    if (req.method === 'GET' && req.url === '/status') {
      json(200, {
        hasDevice: !!lastScreenDeviceId,
        hasScreen: hasScreenDevice,
      });
      return;
    }

    json(404, { error: 'not_found' });
  });

  speakApi.listen(19301, '127.0.0.1', () => {
    logger.log('speak API: http://127.0.0.1:19301');
  });

  // --- Start bridge connection ---
  bridge.connect();
  await waitForConnection('Bridge', () => bridge.isConnected(), 15_000);

  // --- Graceful shutdown ---
  process.on('SIGINT', () => {
    logger.log('Shutting down...');
    speakApi.close();
    displayQueue.destroy();
    bridge.disconnect();
    cartesia.disconnect();
    deepgram.disconnect();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    logger.log('Shutting down...');
    speakApi.close();
    displayQueue.destroy();
    bridge.disconnect();
    cartesia.disconnect();
    deepgram.disconnect();
    process.exit(0);
  });

  logger.log('JARVIS Voice Service ready.');
  logger.log(`  Cartesia: ${cartesia.isConnected() ? 'connected' : 'connecting...'}`);
  logger.log(`  Deepgram: ${deepgram.isConnected() ? 'connected' : 'connecting...'}`);
  logger.log(`  Phrase cache: ${phraseCache.size} phrases`);
  logger.log(`  Bridge: ${bridge.isConnected() ? 'connected' : 'connecting...'}`);
}

async function waitForConnection(name: string, check: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!check() && (Date.now() - start) < timeoutMs) {
    await new Promise(r => setTimeout(r, 200));
  }
  if (check()) {
    logger.log(`${name}: connected`);
  } else {
    logger.warn(`${name}: connection timeout — will continue anyway`);
  }
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
