import type { CommandResponse } from '../types.js';

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  switch (action) {
    case 'send': return send(params);
    default: return { success: false, error: `Unknown notify action: ${action}` };
  }
}

async function send(params: Record<string, unknown>): Promise<CommandResponse> {
  const title = params.title as string;
  const message = params.message as string;

  if (!title || !message) {
    return { success: false, error: 'Missing title or message parameter' };
  }

  const notifier = await import('node-notifier');
  return new Promise((resolve) => {
    notifier.default.notify(
      { title, message, appID: 'JARVIS' },
      (err: Error | null) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
}
