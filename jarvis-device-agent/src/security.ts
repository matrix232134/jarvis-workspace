import { appendFileSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import type { SecurityConfig } from './types.js';
import * as logger from './logger.js';

let killed = false;
let securityConfig: SecurityConfig;

// Sliding window rate limiters
const rateBuckets = new Map<string, number[]>();

export function init(config: SecurityConfig): void {
  securityConfig = config;
  killed = false;
}

// Kill switch
export function isKilled(): boolean {
  return killed;
}

export function setKilled(value: boolean): void {
  killed = value;
  logger.warn(`Kill switch ${value ? 'ACTIVATED' : 'deactivated'}`);
  audit('_control', value ? 'kill' : 'unkill', {});
}

// Path sandboxing
export function validatePath(filePath: string): { allowed: boolean; reason?: string } {
  const normalized = normalize(resolve(filePath));

  // Check denied paths first
  for (const denied of securityConfig.deniedPaths) {
    const normalizedDenied = normalize(resolve(denied));
    if (normalized.toLowerCase().startsWith(normalizedDenied.toLowerCase())) {
      return { allowed: false, reason: `Path denied: ${normalizedDenied}` };
    }
  }

  // Check allowed paths
  for (const allowed of securityConfig.allowedPaths) {
    const normalizedAllowed = normalize(resolve(allowed));
    if (normalized.toLowerCase().startsWith(normalizedAllowed.toLowerCase())) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: 'Path not in allowed list' };
}

// Rate limiting (sliding window, 1 minute)
export function checkRate(category: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const window = 60_000;

  let bucket = rateBuckets.get(category);
  if (!bucket) {
    bucket = [];
    rateBuckets.set(category, bucket);
  }

  // Remove expired entries
  while (bucket.length > 0 && bucket[0] < now - window) {
    bucket.shift();
  }

  if (bucket.length >= maxPerMinute) {
    return false;
  }

  bucket.push(now);
  return true;
}

// Audit logging
export function audit(subsystem: string, action: string, params: Record<string, unknown>): void {
  if (!securityConfig?.auditLogPath) return;

  const entry = {
    timestamp: new Date().toISOString(),
    subsystem,
    action,
    params: truncateParams(params),
  };

  try {
    appendFileSync(securityConfig.auditLogPath, JSON.stringify(entry) + '\n');
  } catch {
    logger.warn('Failed to write audit log');
  }
}

function truncateParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 200) {
      result[key] = value.slice(0, 200) + '...[truncated]';
    } else {
      result[key] = value;
    }
  }
  return result;
}
