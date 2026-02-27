/**
 * Audio playback via ffmpeg.
 * Accepts raw PCM s16le at 24kHz mono (Cartesia output format).
 * Streams to speakers in real-time.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as logger from '../logger.js';

const FFMPEG_PATH = 'ffmpeg';

export class AudioPlayer {
  private process: ChildProcess | null = null;
  private _playing = false;

  /** Start the playback process. Write PCM chunks via write(). */
  start(sampleRate = 24000): void {
    if (this._playing) return;

    // ffmpeg: read raw PCM from stdin, play to default audio output
    const args = [
      '-f', 's16le',
      '-ar', String(sampleRate),
      '-ac', '1',
      '-i', 'pipe:0',
      '-f', 'waveout', // Windows audio output
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-probesize', '32',
      '-',
    ];

    logger.log(`player: starting playback (sampleRate=${sampleRate})`);

    this.process = spawn(FFMPEG_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._playing = true;

    this.process.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg.includes('error') || msg.includes('Error') || msg.includes('fatal')) {
        logger.error(`player ffmpeg: ${msg}`);
      }
    });

    this.process.on('close', (code) => {
      this._playing = false;
    });

    this.process.on('error', (err) => {
      this._playing = false;
      logger.error(`player: ffmpeg spawn error: ${err.message}`);
    });
  }

  /** Write PCM audio data for playback */
  write(chunk: Buffer): boolean {
    if (!this.process?.stdin || !this._playing) return false;
    try {
      return this.process.stdin.write(chunk);
    } catch {
      return false;
    }
  }

  /** Stop playback immediately */
  stop(): void {
    if (this.process) {
      try {
        this.process.stdin?.end();
      } catch { /* ignore */ }
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this._playing = false;
  }

  get playing(): boolean {
    return this._playing;
  }
}
