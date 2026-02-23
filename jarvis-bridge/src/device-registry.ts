import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { v4 as uuid } from 'uuid';
import type { DeviceRecord, ConnectedDevice, DeviceInfo } from './types.js';
import * as logger from './logger.js';

export const events = new EventEmitter();

const __dirname = dirname(fileURLToPath(import.meta.url));
const devicesPath = resolve(__dirname, '..', 'devices.json');

const registered = new Map<string, DeviceRecord>();
const connected = new Map<string, ConnectedDevice>();

export function load(): void {
  if (!existsSync(devicesPath)) return;
  try {
    const raw = readFileSync(devicesPath, 'utf-8');
    const devices: DeviceRecord[] = JSON.parse(raw);
    for (const d of devices) {
      registered.set(d.id, d);
    }
    logger.log(`Loaded ${registered.size} registered device(s)`);
  } catch {
    logger.warn('Could not load devices.json, starting fresh');
  }
}

function save(): void {
  const devices = Array.from(registered.values());
  writeFileSync(devicesPath, JSON.stringify(devices, null, 2));
}

export function register(name: string): DeviceRecord {
  const device: DeviceRecord = {
    id: uuid(),
    name,
    token: uuid(),
    createdAt: new Date().toISOString(),
  };
  registered.set(device.id, device);
  save();
  logger.log(`Registered new device: ${name} (${device.id})`);
  return device;
}

export function authenticate(deviceId: string, token: string): boolean {
  const device = registered.get(deviceId);
  return device !== undefined && device.token === token;
}

export function connect(deviceId: string, ws: import('ws').WebSocket, capabilities: string[] = []): ConnectedDevice | undefined {
  const device = registered.get(deviceId);
  if (!device) return undefined;
  const conn: ConnectedDevice = { ...device, ws, connectedAt: new Date(), capabilities };
  connected.set(deviceId, conn);
  events.emit('change', { event: 'connected', deviceId, device: toDeviceInfo(conn) });
  return conn;
}

export function disconnect(deviceId: string): void {
  connected.delete(deviceId);
  events.emit('change', { event: 'disconnected', deviceId });
}

export function getConnected(deviceId: string): ConnectedDevice | undefined {
  return connected.get(deviceId);
}

export function findByCapability(cap: string): ConnectedDevice | undefined {
  for (const conn of connected.values()) {
    if (conn.capabilities.includes(cap)) return conn;
  }
  return undefined;
}

export function getAllConnected(): ConnectedDevice[] {
  return Array.from(connected.values());
}

export function getDeviceIdByWs(ws: import('ws').WebSocket): string | undefined {
  for (const [id, conn] of connected.entries()) {
    if (conn.ws === ws) return id;
  }
  return undefined;
}

export function registeredCount(): number {
  return registered.size;
}

export function connectedCount(): number {
  return connected.size;
}

function toDeviceInfo(conn: ConnectedDevice): DeviceInfo {
  return {
    id: conn.id,
    name: conn.name,
    capabilities: conn.capabilities,
    connectedAt: conn.connectedAt.toISOString(),
  };
}

export function getAllConnectedInfo(): DeviceInfo[] {
  return Array.from(connected.values()).map(toDeviceInfo);
}
