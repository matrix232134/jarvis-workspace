/**
 * Audio feedback — chimes and visual state indicators.
 * Generates simple tone chimes procedurally (no external WAV files needed).
 */

import { AudioPlayer } from './audio-player.js';
import * as logger from '../logger.js';

// Generate a simple sine wave tone as PCM s16le
function generateTone(frequencyHz: number, durationMs: number, sampleRate = 24000, volume = 0.3): Buffer {
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const buffer = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Apply a quick fade in/out envelope
    const envelope = Math.min(1, i / (sampleRate * 0.01)) * Math.min(1, (numSamples - i) / (sampleRate * 0.01));
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * volume * envelope;
    const int16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    buffer.writeInt16LE(int16, i * 2);
  }
  return buffer;
}

// Pre-generate chime sounds
const CHIMES = {
  listening: generateChime([880, 1100], 100),     // Two-note ascending chime
  sessionEnd: generateChime([880, 660], 80),      // Two-note descending
  error: generateChime([330, 220], 150),           // Low descending
  proactive: generateChime([660, 880, 1100], 80),  // Three-note ascending
};

function generateChime(frequencies: number[], noteDurationMs: number): Buffer {
  const buffers: Buffer[] = [];
  for (const freq of frequencies) {
    buffers.push(generateTone(freq, noteDurationMs));
    // Small gap between notes
    buffers.push(Buffer.alloc(Math.floor(24000 * 0.02) * 2)); // 20ms silence
  }
  return Buffer.concat(buffers);
}

export type ChimeType = keyof typeof CHIMES;

export class Feedback {
  private player: AudioPlayer | null = null;

  /** Play a chime sound. Creates a temporary player. */
  playChime(type: ChimeType): void {
    const audio = CHIMES[type];
    if (!audio) return;

    // Create a fresh player for the chime (don't interfere with main playback)
    const chimePlayer = new AudioPlayer();
    chimePlayer.start(24000);
    chimePlayer.write(audio);

    // Auto-stop after the chime duration + buffer
    const durationMs = (audio.length / 2 / 24000) * 1000 + 200;
    setTimeout(() => {
      chimePlayer.stop();
    }, durationMs);

    logger.log(`feedback: played ${type} chime`);
  }
}
