import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DeviceAgentConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, '..', 'device-agent-config.json');

let config: DeviceAgentConfig;

export function loadConfig(): DeviceAgentConfig {
  const raw = readFileSync(configPath, 'utf-8');
  config = JSON.parse(raw) as DeviceAgentConfig;
  return config;
}

export function saveConfig(updated: DeviceAgentConfig): void {
  config = updated;
  writeFileSync(configPath, JSON.stringify(updated, null, 2));
}

export function getConfig(): DeviceAgentConfig {
  return config;
}
