import type { CommandResponse } from '../types.js';
import * as security from '../security.js';
import { getConfig } from '../config.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

export async function handle(action: string, params: Record<string, unknown>): Promise<CommandResponse> {
  switch (action) {
    case 'capture': return capture(params);
    default: return { success: false, error: `Unknown screen action: ${action}` };
  }
}

async function capture(params: Record<string, unknown>): Promise<CommandResponse> {
  const config = getConfig();
  if (!security.checkRate('screen', config.security.maxScreenshotsPerMinute)) {
    return { success: false, error: 'Rate limit exceeded for screenshots' };
  }

  const scale = typeof params.scale === 'number' ? params.scale : undefined;
  const region = params.region as { x: number; y: number; width: number; height: number } | undefined;

  if (scale !== undefined && (scale <= 0 || scale > 1)) {
    return { success: false, error: 'scale must be > 0 and <= 1' };
  }
  if (region && (typeof region.x !== 'number' || typeof region.y !== 'number' ||
      typeof region.width !== 'number' || typeof region.height !== 'number')) {
    return { success: false, error: 'region requires numeric x, y, width, height' };
  }

  const id = randomUUID();
  const tmpPng = join(tmpdir(), `jarvis-screenshot-${id}.png`);
  const tmpPs1 = join(tmpdir(), `jarvis-screenshot-${id}.ps1`);
  const outPath = tmpPng.replace(/\\/g, '\\\\');

  // Build capture bounds — either region or full screen
  let boundsSetup: string;
  if (region) {
    boundsSetup = `
$captX = ${region.x}
$captY = ${region.y}
$captW = ${region.width}
$captH = ${region.height}`;
  } else {
    boundsSetup = `
$screenBounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$captX = $screenBounds.X
$captY = $screenBounds.Y
$captW = $screenBounds.Width
$captH = $screenBounds.Height`;
  }

  // Build optional scale step
  let scaleStep = '';
  if (scale !== undefined && scale < 1) {
    scaleStep = `
$newW = [int]($captW * ${scale})
$newH = [int]($captH * ${scale})
$scaled = New-Object System.Drawing.Bitmap($newW, $newH)
$sg = [System.Drawing.Graphics]::FromImage($scaled)
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$sg.DrawImage($bitmap, 0, 0, $newW, $newH)
$sg.Dispose()
$bitmap.Dispose()
$bitmap = $scaled`;
  }

  const script = `
[void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")
[void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
${boundsSetup}
$bitmap = New-Object System.Drawing.Bitmap($captW, $captH)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($captX, $captY, 0, 0, (New-Object System.Drawing.Size($captW, $captH)))
$graphics.Dispose()
${scaleStep}
$bitmap.Save("${outPath}", [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
`;

  try {
    writeFileSync(tmpPs1, script, 'utf-8');
    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`);

    const buffer = readFileSync(tmpPng);
    const imageBase64 = buffer.toString('base64');
    return { success: true, data: { imageBase64, format: 'png', sizeBytes: buffer.length } };
  } finally {
    try { unlinkSync(tmpPs1); } catch { /* ignore */ }
    try { unlinkSync(tmpPng); } catch { /* ignore */ }
  }
}
