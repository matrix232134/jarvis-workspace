import type { CommandResponse } from '../types.js';
import * as security from '../security.js';
import { getConfig } from '../config.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  const config = getConfig();
  if (!security.checkRate('input', config.security.maxInputActionsPerMinute)) {
    return { success: false, error: 'Rate limit exceeded for input actions' };
  }

  switch (action) {
    case 'click': return click(params);
    case 'type': return typeText(params);
    case 'hotkey': return hotkey(params);
    case 'scroll': return scroll(params);
    case 'moveMouse': return moveMouse(params);
    default: return { success: false, error: `Unknown input action: ${action}` };
  }
}

// All input injection uses PowerShell with System.Windows.Forms and user32.dll
// This avoids the heavy @nut-tree/nut-js dependency and its native build requirements

async function click(params: Record<string, unknown>): Promise<CommandResponse> {
  const x = params.x as number;
  const y = params.y as number;
  const button = (params.button as string) ?? 'left';
  const doubleClick = params.doubleClick === true;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return { success: false, error: 'Missing x or y parameter' };
  }

  // mouse_event flags: LEFT 0x0002/0x0004, RIGHT 0x0008/0x0010, MIDDLE 0x0020/0x0040
  let downFlag: string;
  let upFlag: string;
  switch (button) {
    case 'right':  downFlag = '0x0008'; upFlag = '0x0010'; break;
    case 'middle': downFlag = '0x0020'; upFlag = '0x0040'; break;
    default:       downFlag = '0x0002'; upFlag = '0x0004'; break;
  }

  const clicks = doubleClick ? 2 : 1;
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Mouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
  public static void Click(int x, int y, int clicks) {
    SetCursorPos(x, y);
    for (int i = 0; i < clicks; i++) {
      mouse_event(${downFlag}, 0, 0, 0, 0);
      mouse_event(${upFlag}, 0, 0, 0, 0);
    }
  }
}
"@
[Mouse]::Click(${x}, ${y}, ${clicks})
`;
  await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
  return { success: true };
}

async function typeText(params: Record<string, unknown>): Promise<CommandResponse> {
  const text = params.text as string;
  if (typeof text !== 'string') {
    return { success: false, error: 'Missing text parameter' };
  }

  // Use SendKeys via PowerShell — handles special chars properly
  const escaped = text.replace(/[+^%~(){}[\]]/g, '{$&}');
  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped.replace(/'/g, "''")}')`;
  await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`);
  return { success: true };
}

async function hotkey(params: Record<string, unknown>): Promise<CommandResponse> {
  const keys = params.keys as string[];
  if (!Array.isArray(keys) || keys.length === 0) {
    return { success: false, error: 'Missing keys array parameter' };
  }

  // Convert key names to SendKeys format
  const keyMap: Record<string, string> = {
    ctrl: '^', alt: '%', shift: '+',
    enter: '{ENTER}', tab: '{TAB}', escape: '{ESC}', esc: '{ESC}',
    backspace: '{BACKSPACE}', delete: '{DELETE}', del: '{DELETE}',
    up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
    home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}',
    f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}', f5: '{F5}',
    f6: '{F6}', f7: '{F7}', f8: '{F8}', f9: '{F9}', f10: '{F10}',
    f11: '{F11}', f12: '{F12}', space: ' ',
  };

  let sendKeysStr = '';
  const modifiers: string[] = [];

  for (const key of keys) {
    const lower = key.toLowerCase();
    const mapped = keyMap[lower];
    if (mapped && (lower === 'ctrl' || lower === 'alt' || lower === 'shift')) {
      modifiers.push(mapped);
    } else if (mapped) {
      sendKeysStr = modifiers.join('') + mapped;
    } else {
      sendKeysStr = modifiers.join('') + key.toLowerCase();
    }
  }

  if (!sendKeysStr) {
    return { success: false, error: 'Could not build key sequence' };
  }

  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKeysStr.replace(/'/g, "''")}')`;
  await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`);
  return { success: true };
}

async function scroll(params: Record<string, unknown>): Promise<CommandResponse> {
  const x = params.x as number ?? 0;
  const y = params.y as number ?? 0;
  const amount = params.amount as number;
  const direction = (params.direction as string) ?? 'down';

  if (typeof amount !== 'number') {
    return { success: false, error: 'Missing amount parameter' };
  }

  const scrollAmount = direction === 'up' ? amount * 120 : -(amount * 120);
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Scroll {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
  public static void Do(int x, int y, int amount) {
    SetCursorPos(x, y);
    mouse_event(0x0800, 0, 0, amount, 0); // WHEEL
  }
}
"@
[Scroll]::Do(${x}, ${y}, ${scrollAmount})
`;
  await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
  return { success: true };
}

async function moveMouse(params: Record<string, unknown>): Promise<CommandResponse> {
  const x = params.x as number;
  const y = params.y as number;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return { success: false, error: 'Missing x or y parameter' };
  }

  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseMove {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
}
"@
[MouseMove]::SetCursorPos(${x}, ${y})
`;
  await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
  return { success: true };
}
