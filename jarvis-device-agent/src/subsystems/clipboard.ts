import type { CommandResponse } from '../types.js';

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  switch (action) {
    case 'get': return get();
    case 'set': return set(params);
    default: return { success: false, error: `Unknown clipboard action: ${action}` };
  }
}

async function get(): Promise<CommandResponse> {
  const clipboardy = await import('clipboardy');
  const text = await clipboardy.default.read();
  return { success: true, data: { text } };
}

async function set(params: Record<string, unknown>): Promise<CommandResponse> {
  const text = params.text as string;
  if (typeof text !== 'string') {
    return { success: false, error: 'Missing text parameter' };
  }
  const clipboardy = await import('clipboardy');
  await clipboardy.default.write(text);
  return { success: true };
}
