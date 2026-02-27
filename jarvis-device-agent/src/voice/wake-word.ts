/**
 * Wake word detection via OpenWakeWord (ONNX-based).
 * No API keys, no activation limits — runs fully locally.
 *
 * Pipeline: raw 16kHz PCM → melspectrogram.onnx → embedding_model.onnx → hey_jarvis_v0.1.onnx
 *
 * Keywords:
 *   0: "hey jarvis" — main wake word
 */

import { InferenceSession, Tensor } from 'onnxruntime-node';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as logger from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = resolve(__dirname, '../../models');

// Pipeline constants
const MEL_BANDS = 32;
const MEL_WINDOW = 76;   // mel frames needed for one embedding
const MEL_STRIDE = 8;    // mel frames between embeddings
const EMB_DIM = 96;      // embedding vector dimension
const EMB_WINDOW = 16;   // embeddings needed for classifier
const FRAME_SAMPLES = 1280; // 80ms at 16kHz

export type KeywordIndex = number;

export interface WakeWordConfig {
  threshold?: number;   // Detection threshold (default: 0.5)
  modelsDir?: string;   // Override models directory
}

export class WakeWordDetector {
  private melSession: InferenceSession | null = null;
  private embSession: InferenceSession | null = null;
  private kwSession: InferenceSession | null = null;
  private kwInputName = '';

  // Accumulation buffers
  private melFrames: number[][] = [];          // each entry is 32-dim mel frame
  private embeddings: Float32Array[] = [];     // each entry is 96-dim embedding
  private melFramesSinceLastEmb = 0;

  private threshold = 0.5;
  private _frameLength = FRAME_SAMPLES;
  private _sampleRate = 16000;
  private _initialized = false;

  async init(config: WakeWordConfig = {}): Promise<void> {
    this.threshold = config.threshold ?? 0.5;
    const modelsDir = config.modelsDir ?? MODELS_DIR;

    try {
      const [mel, emb, kw] = await Promise.all([
        InferenceSession.create(resolve(modelsDir, 'melspectrogram.onnx')),
        InferenceSession.create(resolve(modelsDir, 'embedding_model.onnx')),
        InferenceSession.create(resolve(modelsDir, 'hey_jarvis_v0.1.onnx')),
      ]);

      this.melSession = mel;
      this.embSession = emb;
      this.kwSession = kw;
      this.kwInputName = kw.inputNames[0];

      this._initialized = true;
      logger.log(`wake-word: initialized (openWakeWord, threshold=${this.threshold})`);
    } catch (err) {
      logger.error(`wake-word: failed to load ONNX models: ${err}`);
      logger.warn('wake-word: running without wake word detection');
    }
  }

  /**
   * Process a frame of 16-bit PCM audio.
   * @param frame Buffer of exactly frameLength * 2 bytes (1280 int16 samples = 80ms)
   * @returns keyword index (0 = hey jarvis) or -1
   */
  async process(frame: Buffer): Promise<KeywordIndex> {
    if (!this._initialized || !this.melSession || !this.embSession || !this.kwSession) {
      return -1;
    }

    // Convert int16 PCM to float32 (raw cast — no division by 32768)
    const int16 = new Int16Array(frame.buffer, frame.byteOffset, frame.byteLength / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i];
    }

    // --- Stage 1: Mel spectrogram ---
    const melInput = new Tensor('float32', float32, [1, FRAME_SAMPLES]);
    const melResult = await this.melSession.run({ input: melInput });
    const melRaw = Object.values(melResult)[0].data as Float32Array;

    // Normalize: output / 10.0 + 2.0
    const numMelFrames = melRaw.length / MEL_BANDS;
    for (let i = 0; i < numMelFrames; i++) {
      const frame32: number[] = new Array(MEL_BANDS);
      for (let j = 0; j < MEL_BANDS; j++) {
        frame32[j] = melRaw[i * MEL_BANDS + j] / 10.0 + 2.0;
      }
      this.melFrames.push(frame32);
      this.melFramesSinceLastEmb++;
    }

    // --- Stage 2: Embedding (when enough mel frames accumulated) ---
    while (
      this.melFrames.length >= MEL_WINDOW &&
      this.melFramesSinceLastEmb >= MEL_STRIDE
    ) {
      const startIdx = this.melFrames.length - MEL_WINDOW;
      const embInputData = new Float32Array(MEL_WINDOW * MEL_BANDS);
      for (let i = 0; i < MEL_WINDOW; i++) {
        const row = this.melFrames[startIdx + i];
        for (let j = 0; j < MEL_BANDS; j++) {
          embInputData[i * MEL_BANDS + j] = row[j];
        }
      }

      const embInput = new Tensor('float32', embInputData, [1, MEL_WINDOW, MEL_BANDS, 1]);
      const embResult = await this.embSession.run({ input_1: embInput });
      const embRaw = Object.values(embResult)[0].data as Float32Array;

      // Copy first 96 values (squeeze from (1,1,1,96) to (96,))
      this.embeddings.push(new Float32Array(embRaw.buffer, embRaw.byteOffset, EMB_DIM).slice());
      this.melFramesSinceLastEmb -= MEL_STRIDE;
    }

    // Trim mel buffer to prevent unbounded growth
    if (this.melFrames.length > 200) {
      this.melFrames = this.melFrames.slice(-MEL_WINDOW);
      this.melFramesSinceLastEmb = Math.min(this.melFramesSinceLastEmb, MEL_STRIDE);
    }

    // --- Stage 3: Classifier (when enough embeddings accumulated) ---
    if (this.embeddings.length >= EMB_WINDOW) {
      const window = this.embeddings.slice(-EMB_WINDOW);
      const kwInputData = new Float32Array(EMB_WINDOW * EMB_DIM);
      for (let i = 0; i < EMB_WINDOW; i++) {
        kwInputData.set(window[i], i * EMB_DIM);
      }

      const kwInput = new Tensor('float32', kwInputData, [1, EMB_WINDOW, EMB_DIM]);
      const kwResult = await this.kwSession.run({ [this.kwInputName]: kwInput });
      const score = (Object.values(kwResult)[0].data as Float32Array)[0];

      if (score > this.threshold) {
        logger.log(`wake-word: detected "hey jarvis" (score=${score.toFixed(3)})`);
        // Clear buffers to prevent rapid re-triggering (cooldown ~1.3s)
        this.embeddings = [];
        this.melFrames = [];
        this.melFramesSinceLastEmb = 0;
        return 0;
      }

      // Trim embedding buffer
      if (this.embeddings.length > 40) {
        this.embeddings = this.embeddings.slice(-EMB_WINDOW);
      }
    }

    return -1;
  }

  get frameLength(): number {
    return this._frameLength;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  release(): void {
    this.melSession = null;
    this.embSession = null;
    this.kwSession = null;
    this.melFrames = [];
    this.embeddings = [];
    this.melFramesSinceLastEmb = 0;
    this._initialized = false;
    logger.log('wake-word: released');
  }
}
