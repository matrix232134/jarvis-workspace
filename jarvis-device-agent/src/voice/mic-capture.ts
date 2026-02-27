/**
 * Microphone capture via ffmpeg (DirectShow on Windows).
 * Outputs raw 16-bit PCM at 16kHz mono.
 * Chunks into exactly frameSize samples for Porcupine wake word detection.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as logger from '../logger.js';

const FFMPEG_PATH = 'ffmpeg';

export class MicCapture {
  private process: ChildProcess | null = null;
  private frameBuffer = Buffer.alloc(0);
  private _active = false;

  /**
   * Start capturing audio.
   * @param onFrame Called with exactly frameSize * 2 bytes (16-bit samples)
   * @param frameSize Number of 16-bit samples per frame (512 for Porcupine)
   * @param deviceName Windows audio input device name (null = default)
   */
  start(onFrame: (frame: Buffer) => void, frameSize = 512, deviceName?: string): void {
    if (this._active) return;

    const bytesPerFrame = frameSize * 2; // 16-bit = 2 bytes per sample
    const input = deviceName ? `audio=${deviceName}` : 'audio=default';

    // ffmpeg: capture from DirectShow audio device, output raw PCM
    const args = [
      '-f', 'dshow',
      '-audio_buffer_size', '50', // 50ms buffer for low latency
      '-i', input,
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      'pipe:1',
    ];

    logger.log(`mic: starting capture (device=${deviceName ?? 'default'}, frameSize=${frameSize})`);

    this.process = spawn(FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout (audio), stderr (logs)
    });

    this._active = true;

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);

      while (this.frameBuffer.length >= bytesPerFrame) {
        const frame = Buffer.from(this.frameBuffer.subarray(0, bytesPerFrame));
        this.frameBuffer = this.frameBuffer.subarray(bytesPerFrame);
        onFrame(frame);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      // ffmpeg writes all its logs to stderr
      const msg = data.toString().trim();
      if (msg && !msg.startsWith('frame=') && !msg.includes('size=')) {
        // Only log non-progress messages
        if (msg.includes('error') || msg.includes('Error') || msg.includes('fatal')) {
          logger.error(`mic ffmpeg: ${msg}`);
        }
      }
    });

    this.process.on('close', (code) => {
      this._active = false;
      if (code !== 0 && code !== null) {
        logger.warn(`mic: ffmpeg exited with code ${code}`);
      }
    });

    this.process.on('error', (err) => {
      this._active = false;
      logger.error(`mic: ffmpeg spawn error: ${err.message}`);
    });
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this._active = false;
    this.frameBuffer = Buffer.alloc(0);
  }

  get active(): boolean {
    return this._active;
  }
}
