function timestamp(): string {
  return new Date().toISOString();
}

export function log(msg: string): void {
  console.log(`[${timestamp()}] ${msg}`);
}

export function warn(msg: string): void {
  console.warn(`[${timestamp()}] WARN: ${msg}`);
}

export function error(msg: string): void {
  console.error(`[${timestamp()}] ERROR: ${msg}`);
}
