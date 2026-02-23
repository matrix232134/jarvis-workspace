export function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export function warn(msg: string): void {
  console.warn(`[${new Date().toISOString()}] WARN: ${msg}`);
}

export function error(msg: string): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${msg}`);
}
