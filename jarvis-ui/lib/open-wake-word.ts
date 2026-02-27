"use client"

/**
 * OpenWakeWord browser detector — ONNX-based, no API keys.
 *
 * Pipeline: 16kHz int16 PCM → melspectrogram.onnx → embedding_model.onnx → hey_jarvis_v0.1.onnx
 *
 * Accepts 512-sample frames from the existing ScriptProcessor and
 * internally accumulates to 1280-sample chunks for inference.
 */

import * as ort from "onnxruntime-web"

const MEL_BANDS = 32
const MEL_WINDOW = 76   // mel frames needed for one embedding
const MEL_STRIDE = 8    // mel frames between embeddings
const EMB_DIM = 96      // embedding vector dimension
const EMB_WINDOW = 16   // embeddings needed for classifier
const CHUNK_SAMPLES = 1280 // 80ms at 16kHz
const BUFFER_CAPACITY = 16000 // 1s pre-allocation at 16kHz

export class OpenWakeWordDetector {
  private melSession: ort.InferenceSession | null = null
  private embSession: ort.InferenceSession | null = null
  private kwSession: ort.InferenceSession | null = null
  private kwInputName = ""

  // Pre-allocated audio accumulator (avoids GC from constant Float32Array creation)
  private audioBuffer = new Float32Array(BUFFER_CAPACITY)
  private audioBufferLen = 0

  // Pipeline buffers
  private melFrames: number[][] = []
  private embeddings: Float32Array[] = []
  private melFramesSinceLastEmb = 0

  private threshold = 0.3
  private gain = 3.0 // software gain — amplifies quiet/distant speech before inference
  private onDetection: (() => void) | null = null
  private busy = false
  private _initialized = false

  get initialized(): boolean {
    return this._initialized
  }

  async init(modelsPath: string, threshold: number, onDetection: () => void, gain = 3.0): Promise<void> {
    this.threshold = threshold
    this.gain = gain
    this.onDetection = onDetection

    // Use WASM backend (works everywhere, no GPU needed for tiny models)
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = "/onnxruntime/"

    const [mel, emb, kw] = await Promise.all([
      ort.InferenceSession.create(`${modelsPath}/melspectrogram.onnx`, {
        executionProviders: ["wasm"],
      }),
      ort.InferenceSession.create(`${modelsPath}/embedding_model.onnx`, {
        executionProviders: ["wasm"],
      }),
      ort.InferenceSession.create(`${modelsPath}/hey_jarvis_v0.1.onnx`, {
        executionProviders: ["wasm"],
      }),
    ])

    this.melSession = mel
    this.embSession = emb
    this.kwSession = kw
    this.kwInputName = kw.inputNames[0]

    // Pre-warm ONNX WASM JIT — first real inference is 2-5x slower without this
    await this.warmup()

    this._initialized = true
    console.log("OpenWakeWord: initialized (hey_jarvis, threshold=" + threshold + ")")
  }

  /**
   * Run dummy inference through each model to trigger WASM JIT compilation.
   * Without this, the first real audio chunk processes slowly.
   */
  private async warmup(): Promise<void> {
    if (!this.melSession || !this.embSession || !this.kwSession) return
    const melInput = new ort.Tensor("float32", new Float32Array(CHUNK_SAMPLES), [1, CHUNK_SAMPLES])
    await this.melSession.run({ input: melInput })
    const embInput = new ort.Tensor("float32", new Float32Array(MEL_WINDOW * MEL_BANDS), [1, MEL_WINDOW, MEL_BANDS, 1])
    await this.embSession.run({ input_1: embInput })
    const kwInput = new ort.Tensor("float32", new Float32Array(EMB_WINDOW * EMB_DIM), [1, EMB_WINDOW, EMB_DIM])
    await this.kwSession.run({ [this.kwInputName]: kwInput })
  }

  /**
   * Feed a frame of int16 PCM audio (any size — internally accumulates to 1280 samples).
   * Never drops audio — accumulates even during inference to prevent detection gaps.
   */
  processFrame(int16: Int16Array): void {
    if (!this._initialized) return

    // Always accumulate — never drop frames during inference
    this.accumulate(int16)

    // Trigger processing when enough data is ready (skip if already draining)
    if (!this.busy && this.audioBufferLen >= CHUNK_SAMPLES) {
      this.busy = true
      this.drainBuffer().finally(() => {
        this.busy = false
      })
    }
  }

  private accumulate(int16: Int16Array): void {
    // Grow buffer if needed (rare — only if inference stalls)
    if (this.audioBufferLen + int16.length > this.audioBuffer.length) {
      const newBuf = new Float32Array(this.audioBuffer.length * 2)
      newBuf.set(this.audioBuffer.subarray(0, this.audioBufferLen))
      this.audioBuffer = newBuf
    }
    // Convert int16 → float32 with software gain, clamped to int16 range.
    // Gain > 1 amplifies quiet/distant speech so the ONNX model sees usable levels.
    const g = this.gain
    for (let i = 0; i < int16.length; i++) {
      const amplified = int16[i] * g
      this.audioBuffer[this.audioBufferLen++] =
        amplified > 32767 ? 32767 : amplified < -32768 ? -32768 : amplified
    }
  }

  private async drainBuffer(): Promise<void> {
    while (this.audioBufferLen >= CHUNK_SAMPLES) {
      const chunk = this.audioBuffer.slice(0, CHUNK_SAMPLES)
      // Shift remaining audio forward in-place
      const remaining = this.audioBufferLen - CHUNK_SAMPLES
      if (remaining > 0) {
        this.audioBuffer.copyWithin(0, CHUNK_SAMPLES, this.audioBufferLen)
      }
      this.audioBufferLen = remaining

      const detected = await this.runPipeline(chunk)
      if (detected && this.onDetection) {
        this.onDetection()
      }
    }
  }

  private async runPipeline(float32: Float32Array): Promise<boolean> {
    if (!this.melSession || !this.embSession || !this.kwSession) return false

    // --- Stage 1: Mel spectrogram ---
    const melInput = new ort.Tensor("float32", float32, [1, CHUNK_SAMPLES])
    const melResult = await this.melSession.run({ input: melInput })
    const melRaw = Object.values(melResult)[0].data as Float32Array

    const numMelFrames = melRaw.length / MEL_BANDS
    for (let i = 0; i < numMelFrames; i++) {
      const frame: number[] = new Array(MEL_BANDS)
      for (let j = 0; j < MEL_BANDS; j++) {
        frame[j] = melRaw[i * MEL_BANDS + j] / 10.0 + 2.0
      }
      this.melFrames.push(frame)
      this.melFramesSinceLastEmb++
    }

    // --- Stage 2: Embedding ---
    while (
      this.melFrames.length >= MEL_WINDOW &&
      this.melFramesSinceLastEmb >= MEL_STRIDE
    ) {
      const startIdx = this.melFrames.length - MEL_WINDOW
      const embInputData = new Float32Array(MEL_WINDOW * MEL_BANDS)
      for (let i = 0; i < MEL_WINDOW; i++) {
        const row = this.melFrames[startIdx + i]
        for (let j = 0; j < MEL_BANDS; j++) {
          embInputData[i * MEL_BANDS + j] = row[j]
        }
      }

      const embInput = new ort.Tensor("float32", embInputData, [1, MEL_WINDOW, MEL_BANDS, 1])
      const embResult = await this.embSession.run({ input_1: embInput })
      const embRaw = Object.values(embResult)[0].data as Float32Array
      this.embeddings.push(new Float32Array(embRaw.buffer, embRaw.byteOffset, EMB_DIM).slice())
      this.melFramesSinceLastEmb -= MEL_STRIDE
    }

    // Trim mel buffer
    if (this.melFrames.length > 200) {
      this.melFrames = this.melFrames.slice(-MEL_WINDOW)
      this.melFramesSinceLastEmb = Math.min(this.melFramesSinceLastEmb, MEL_STRIDE)
    }

    // --- Stage 3: Classifier ---
    if (this.embeddings.length >= EMB_WINDOW) {
      const window = this.embeddings.slice(-EMB_WINDOW)
      const kwInputData = new Float32Array(EMB_WINDOW * EMB_DIM)
      for (let i = 0; i < EMB_WINDOW; i++) {
        kwInputData.set(window[i], i * EMB_DIM)
      }

      const kwInput = new ort.Tensor("float32", kwInputData, [1, EMB_WINDOW, EMB_DIM])
      const kwResult = await this.kwSession.run({ [this.kwInputName]: kwInput })
      const score = (Object.values(kwResult)[0].data as Float32Array)[0]

      if (score > this.threshold) {
        console.log(`OpenWakeWord: detected "hey jarvis" (score=${score.toFixed(3)})`)
        // Clear buffers — cooldown ~1.3s of silence before re-triggering
        this.embeddings = []
        this.melFrames = []
        this.melFramesSinceLastEmb = 0
        this.audioBufferLen = 0
        return true
      }

      // Trim embedding buffer
      if (this.embeddings.length > 40) {
        this.embeddings = this.embeddings.slice(-EMB_WINDOW)
      }
    }

    return false
  }

  release(): void {
    this.melSession = null
    this.embSession = null
    this.kwSession = null
    this.melFrames = []
    this.embeddings = []
    this.audioBuffer = new Float32Array(BUFFER_CAPACITY)
    this.audioBufferLen = 0
    this.melFramesSinceLastEmb = 0
    this._initialized = false
    this.onDetection = null
  }
}
