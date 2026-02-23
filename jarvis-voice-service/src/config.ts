import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VoiceServiceConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'voice-service-config.json');

let config: VoiceServiceConfig;

export function loadConfig(): VoiceServiceConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(raw) as VoiceServiceConfig;
  return config;
}

export function getConfig(): VoiceServiceConfig {
  if (!config) return loadConfig();
  return config;
}

export function saveConfig(updated: VoiceServiceConfig): void {
  config = updated;
  writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}
