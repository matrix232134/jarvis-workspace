import type { SubsystemHandler, CommandResponse } from './types.js';
import * as security from './security.js';
import * as logger from './logger.js';

const handlers = new Map<string, SubsystemHandler>();

export function register(subsystem: string, handler: SubsystemHandler): void {
  handlers.set(subsystem, handler);
  logger.log(`Registered subsystem: ${subsystem}`);
}

export async function dispatch(subsystem: string, action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  // Kill switch check
  if (security.isKilled() && subsystem !== '_control') {
    return { success: false, error: 'Kill switch is active — all commands blocked' };
  }

  // Handle _control subsystem directly
  if (subsystem === '_control') {
    if (action === 'kill') {
      security.setKilled(true);
      return { success: true, data: { killed: true } };
    }
    if (action === 'unkill') {
      security.setKilled(false);
      return { success: true, data: { killed: false } };
    }
    if (action === 'status') {
      return { success: true, data: { killed: security.isKilled() } };
    }
    return { success: false, error: `Unknown control action: ${action}` };
  }

  const handler = handlers.get(subsystem);
  if (!handler) {
    return { success: false, error: `Unknown subsystem: ${subsystem}` };
  }

  // Audit log
  security.audit(subsystem, action, params);

  const start = performance.now();
  try {
    const result = await handler(action, params);
    result.durationMs = Math.round(performance.now() - start);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Subsystem ${subsystem}.${action} failed: ${message}`);
    return { success: false, error: message, durationMs: Math.round(performance.now() - start) };
  }
}
