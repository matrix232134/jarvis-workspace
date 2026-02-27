import { readFileSync, writeFileSync, readdirSync, renameSync, unlinkSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommandResponse } from '../types.js';
import * as security from '../security.js';

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  switch (action) {
    case 'read': return read(params);
    case 'write': return write(params);
    case 'list': return list(params);
    case 'move': return move(params);
    case 'delete': return del(params);
    case 'exists': return exists(params);
    default: return { success: false, error: `Unknown files action: ${action}` };
  }
}

function checkPath(path: string): CommandResponse | null {
  const check = security.validatePath(path);
  if (!check.allowed) {
    return { success: false, error: check.reason ?? 'Path not allowed' };
  }
  return null;
}

async function read(params: Record<string, unknown>): Promise<CommandResponse> {
  const path = resolve(params.path as string);
  const encoding = (params.encoding as BufferEncoding) ?? 'utf-8';

  const denied = checkPath(path);
  if (denied) return denied;

  const content = readFileSync(path, encoding);
  return { success: true, data: { content } };
}

async function write(params: Record<string, unknown>): Promise<CommandResponse> {
  const path = resolve(params.path as string);
  const content = params.content as string;

  if (typeof content !== 'string') {
    return { success: false, error: 'Missing content parameter' };
  }

  const denied = checkPath(path);
  if (denied) return denied;

  writeFileSync(path, content, 'utf-8');
  return { success: true };
}

async function list(params: Record<string, unknown>): Promise<CommandResponse> {
  const path = resolve(params.path as string);

  const denied = checkPath(path);
  if (denied) return denied;

  const entries = readdirSync(path, { withFileTypes: true }).map((entry) => {
    const entryPath = resolve(path, entry.name);
    let size = 0;
    let modified = '';
    try {
      const stat = statSync(entryPath);
      size = stat.size;
      modified = stat.mtime.toISOString();
    } catch { /* ignore */ }

    return {
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size,
      modified,
    };
  });

  return { success: true, data: { entries } };
}

async function move(params: Record<string, unknown>): Promise<CommandResponse> {
  const source = resolve(params.source as string);
  const destination = resolve(params.destination as string);

  const deniedSrc = checkPath(source);
  if (deniedSrc) return deniedSrc;

  const deniedDst = checkPath(destination);
  if (deniedDst) return deniedDst;

  renameSync(source, destination);
  return { success: true };
}

async function del(params: Record<string, unknown>): Promise<CommandResponse> {
  const path = resolve(params.path as string);

  const denied = checkPath(path);
  if (denied) return denied;

  unlinkSync(path);
  return { success: true };
}

async function exists(params: Record<string, unknown>): Promise<CommandResponse> {
  const path = resolve(params.path as string);

  const denied = checkPath(path);
  if (denied) return denied;

  const fileExists = existsSync(path);
  let type: string | undefined;
  if (fileExists) {
    const stat = statSync(path);
    type = stat.isDirectory() ? 'directory' : 'file';
  }

  return { success: true, data: { exists: fileExists, type } };
}
