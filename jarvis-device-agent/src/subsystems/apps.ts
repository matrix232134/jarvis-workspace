import type { CommandResponse } from '../types.js';
import { exec, spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  switch (action) {
    case 'list': return list();
    case 'getActive': return getActive();
    case 'focus': return focus(params);
    case 'launch': return launch(params);
    case 'close': return close(params);
    default: return { success: false, error: `Unknown apps action: ${action}` };
  }
}

async function runPs1(script: string): Promise<string> {
  const file = join(tmpdir(), `jarvis-${randomUUID()}.ps1`);
  try {
    writeFileSync(file, script, 'utf-8');
    const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${file}"`);
    return stdout.trim();
  } finally {
    try { unlinkSync(file); } catch { /* ignore */ }
  }
}

async function list(): Promise<CommandResponse> {
  const script = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress`;
  const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);

  const raw = JSON.parse(stdout || '[]');
  const processes = (Array.isArray(raw) ? raw : [raw]).map((p: Record<string, unknown>) => ({
    pid: p.Id,
    name: p.ProcessName,
    title: p.MainWindowTitle,
  }));

  return { success: true, data: { processes } };
}

async function getActive(): Promise<CommandResponse> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ActiveWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int pid);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$hwnd = [ActiveWin]::GetForegroundWindow()
$pid = 0
[ActiveWin]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
$sb = New-Object System.Text.StringBuilder 256
[ActiveWin]::GetWindowText($hwnd, $sb, 256) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
@{ pid = $pid; name = if ($proc) { $proc.ProcessName } else { "unknown" }; title = $sb.ToString() } | ConvertTo-Json -Compress
`;
  const stdout = await runPs1(script);
  const result = JSON.parse(stdout);
  return { success: true, data: { pid: result.pid, name: result.name, title: result.title } };
}

async function focus(params: Record<string, unknown>): Promise<CommandResponse> {
  const pid = params.pid as number | undefined;
  const title = params.title as string | undefined;

  if (!pid && !title) {
    return { success: false, error: 'Missing pid or title parameter' };
  }

  let script: string;
  if (pid) {
    script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FocusWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$proc = Get-Process -Id ${pid} -ErrorAction Stop
[FocusWin]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
`;
  } else {
    const safeTitle = title!.replace(/'/g, "''");
    script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FocusWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*${safeTitle}*' } | Select-Object -First 1
if ($proc) { [FocusWin]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null } else { throw "Window not found" }
`;
  }

  await runPs1(script);
  return { success: true };
}

async function launch(params: Record<string, unknown>): Promise<CommandResponse> {
  const command = params.command as string;
  const args = (params.args as string[]) ?? [];

  if (!command) {
    return { success: false, error: 'Missing command parameter' };
  }

  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();

  return { success: true, data: { pid: child.pid } };
}

async function close(params: Record<string, unknown>): Promise<CommandResponse> {
  const pid = params.pid as number;

  if (typeof pid !== 'number') {
    return { success: false, error: 'Missing pid parameter' };
  }

  await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`);
  return { success: true };
}
