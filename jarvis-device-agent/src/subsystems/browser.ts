import type { CommandResponse } from '../types.js';

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  switch (action) {
    case 'open': return open(params);
    case 'search': return search(params);
    default: return { success: false, error: `Unknown browser action: ${action}` };
  }
}

async function open(params: Record<string, unknown>): Promise<CommandResponse> {
  const url = params.url as string;
  if (typeof url !== 'string' || !url) {
    return { success: false, error: 'Missing url parameter' };
  }
  const openModule = await import('open');
  await openModule.default(url);
  return { success: true, data: { url } };
}

async function search(params: Record<string, unknown>): Promise<CommandResponse> {
  const query = params.query as string;
  if (typeof query !== 'string' || !query) {
    return { success: false, error: 'Missing query parameter' };
  }
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const openModule = await import('open');
  await openModule.default(url);
  return { success: true, data: { query, url } };
}
