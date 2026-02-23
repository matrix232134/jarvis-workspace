import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BridgeConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, '..', 'bridge-config.json');

export function loadConfig(): BridgeConfig {
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as BridgeConfig;
}
