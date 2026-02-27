/**
 * AudioWorklet processor for microphone capture.
 * Accumulates 128-sample render quanta into 512-sample frames,
 * converts to int16 PCM, and posts the raw ArrayBuffer to the main thread.
 */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buffer = new Float32Array(512)
    this._writePos = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channelData = input[0]
    const len = channelData.length

    // Fast copy into pre-allocated buffer
    for (let i = 0; i < len; i++) {
      this._buffer[this._writePos++] = channelData[i]

      if (this._writePos === 512) {
        // Buffer full — convert float32 → int16 and send
        const int16 = new Int16Array(512)
        for (let j = 0; j < 512; j++) {
          const s = Math.max(-1, Math.min(1, this._buffer[j]))
          int16[j] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        // Transfer the raw ArrayBuffer (most reliable cross-browser)
        this.port.postMessage(int16.buffer, [int16.buffer])
        this._writePos = 0
      }
    }

    return true
  }
}

registerProcessor("mic-processor", MicProcessor)
